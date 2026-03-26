/**
 * Yields Relation objects for each batch, used by inBatches.
 *
 * Mirrors: ActiveRecord::Batches::BatchEnumerator
 */
export class BatchEnumerator {
  readonly ofVal: number;
  readonly relation: any;

  constructor(ofVal: number, relation: any) {
    this.ofVal = ofVal;
    this.relation = relation;
  }
}
