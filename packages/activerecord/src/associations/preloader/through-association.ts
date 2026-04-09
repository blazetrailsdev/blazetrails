import type { Base } from "../../base.js";
import type { AssociationReflection, ThroughReflection } from "../../reflection.js";
import { _reflectOnAssociation } from "../../reflection.js";
import { Association } from "./association.js";
import { Preloader } from "../preloader.js";
import { pluralize, singularize } from "@blazetrails/activesupport";

type AssociationLikeReflection = AssociationReflection | ThroughReflection;

/**
 * Handles preloading through associations by first loading the
 * intermediate (through) records, then loading the source records
 * from those intermediates.
 *
 * Mirrors: ActiveRecord::Associations::Preloader::ThroughAssociation
 */
export class ThroughAssociation extends Association {
  private _sourcePreloaders: Association[] | undefined;
  private _throughPreloaders: Association[] | undefined;
  private _sourceRecordsByOwner: Map<Base, Base[]> | undefined;
  private _throughRecordsByOwner: Map<Base, Base[]> | undefined;
  private _throughPreloadedRecords: Base[] | undefined;

  constructor(
    klass: typeof Base,
    owners: Base[],
    reflection: AssociationLikeReflection,
    preloadScope?: any,
    reflectionScope?: any,
    associateByDefault: boolean = true,
  ) {
    super(klass, owners, reflection, preloadScope, reflectionScope, associateByDefault);
  }

  get preloadedRecords(): Base[] {
    if (this._throughPreloadedRecords !== undefined) return this._throughPreloadedRecords;
    this._throughPreloadedRecords = this._getSourcePreloaders().flatMap((l) => l.preloadedRecords);
    return this._throughPreloadedRecords;
  }

  async recordsByOwner(): Promise<Map<Base, Base[]>> {
    const result = new Map<Base, Base[]>();
    const throughRecordsByOwner = await this._getThroughRecordsByOwner();
    const sourceRecordsByOwner = await this._getSourceRecordsByOwner();

    for (const owner of this.owners) {
      if (this.isLoaded(owner)) {
        result.set(owner, this.targetFor(owner));
        continue;
      }

      const throughRecords = throughRecordsByOwner.get(owner) ?? [];
      let records = throughRecords.flatMap((tr) => sourceRecordsByOwner.get(tr) ?? []);
      records = records.filter((r) => r != null);

      result.set(owner, records);
    }

    return result;
  }

  runnableLoaders(): Association[] {
    if (this._dataAvailable()) {
      return [this];
    }

    const throughPreloaders = this._getThroughPreloaders();
    if (throughPreloaders.every((l) => l.isRun())) {
      return this._getSourcePreloaders().flatMap((l) => l.runnableLoaders());
    }

    return throughPreloaders.flatMap((l) => l.runnableLoaders());
  }

  futureClasses(): (typeof Base)[] {
    if (this.isRun()) return [];

    const throughPreloaders = this._getThroughPreloaders();
    if (throughPreloaders.every((l) => l.isRun())) {
      const seen = new Set<typeof Base>();
      return this._getSourcePreloaders()
        .flatMap((l) => l.futureClasses())
        .filter((k) => {
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
    }

    const throughClasses = throughPreloaders.flatMap((l) => l.futureClasses());
    const sourceRefl = this._sourceReflection;
    const sourceClasses: (typeof Base)[] = [];
    if (sourceRefl) {
      try {
        for (const chainRefl of sourceRefl.chain) {
          if (!(chainRefl as any).isPolymorphic?.()) {
            try {
              sourceClasses.push(chainRefl.klass);
            } catch {
              /* polymorphic */
            }
          }
        }
      } catch {
        /* chain resolution may fail */
      }
    }

    const seen = new Set<typeof Base>();
    return [...throughClasses, ...sourceClasses].filter((k) => {
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  private _dataAvailable(): boolean {
    return (
      this.owners.every((owner) => this.isLoaded(owner)) ||
      (this._getThroughPreloaders().every((l) => l.isRun()) &&
        this._getSourcePreloaders().every((l) => l.isRun()))
    );
  }

  private _getSourcePreloaders(): Association[] {
    if (this._sourcePreloaders !== undefined) return this._sourcePreloaders;

    const middleRecords = this._getMiddleRecords();
    const sourceRefl = this._sourceReflection;
    if (!sourceRefl || middleRecords.length === 0) {
      return [];
    }

    const preloader = new Preloader({
      records: middleRecords,
      associations: [sourceRefl.name],
      scope: this.scope,
      associateByDefault: false,
    });
    this._sourcePreloaders = preloader.loaders;
    return this._sourcePreloaders;
  }

  private _getThroughPreloaders(): Association[] {
    if (this._throughPreloaders !== undefined) return this._throughPreloaders;

    const throughRefl = this._throughReflection;
    if (!throughRefl) {
      this._throughPreloaders = [];
      return this._throughPreloaders;
    }

    const preloader = new Preloader({
      records: this.owners,
      associations: [throughRefl.name],
      associateByDefault: false,
    });
    this._throughPreloaders = preloader.loaders;
    return this._throughPreloaders;
  }

  private _getMiddleRecords(): Base[] {
    return this._getThroughPreloaders().flatMap((l) => l.preloadedRecords);
  }

  private async _getSourceRecordsByOwner(): Promise<Map<Base, Base[]>> {
    if (this._sourceRecordsByOwner !== undefined) return this._sourceRecordsByOwner;
    const maps = await Promise.all(this._getSourcePreloaders().map((l) => l.recordsByOwner()));
    this._sourceRecordsByOwner = new Map();
    for (const map of maps) {
      for (const [k, v] of map) {
        const existing = this._sourceRecordsByOwner.get(k);
        if (existing) {
          existing.push(...v);
        } else {
          this._sourceRecordsByOwner.set(k, [...v]);
        }
      }
    }
    return this._sourceRecordsByOwner;
  }

  private async _getThroughRecordsByOwner(): Promise<Map<Base, Base[]>> {
    if (this._throughRecordsByOwner !== undefined) return this._throughRecordsByOwner;
    const maps = await Promise.all(this._getThroughPreloaders().map((l) => l.recordsByOwner()));
    this._throughRecordsByOwner = new Map();
    for (const map of maps) {
      for (const [k, v] of map) {
        const existing = this._throughRecordsByOwner.get(k);
        if (existing) {
          existing.push(...v);
        } else {
          this._throughRecordsByOwner.set(k, [...v]);
        }
      }
    }
    return this._throughRecordsByOwner;
  }

  private get _throughReflection(): AssociationLikeReflection | null {
    const refl = (this.reflection as any).throughReflection;
    if (refl) return refl;

    const model = (this.reflection as any).activeRecord;
    const assocDef = model?._associations?.find((a: any) => a.name === this.reflection.name);
    if (assocDef?.options?.through) {
      return _reflectOnAssociation(
        model,
        assocDef.options.through,
      ) as AssociationLikeReflection | null;
    }
    return null;
  }

  private get _sourceReflection(): AssociationLikeReflection | null {
    const refl = (this.reflection as any).sourceReflection;
    if (refl && refl !== this.reflection) return refl;

    const throughRefl = this._throughReflection;
    if (!throughRefl) return null;
    const model = (this.reflection as any).activeRecord;
    const assocDef = model?._associations?.find((a: any) => a.name === this.reflection.name);
    const sourceName = assocDef?.options?.source ?? (this.reflection as any).source;
    if (sourceName) {
      let throughKlass: typeof Base | null = null;
      try {
        throughKlass = throughRefl.klass;
      } catch {
        // klass resolution may fail for polymorphic reflections
      }
      if (throughKlass) {
        const candidates = [sourceName, pluralize(sourceName), singularize(sourceName)];
        for (const name of candidates) {
          const r = _reflectOnAssociation(throughKlass, name) as AssociationLikeReflection | null;
          if (r) return r;
        }
      }
    }
    return null;
  }
}
