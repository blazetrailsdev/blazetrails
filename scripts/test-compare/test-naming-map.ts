/**
 * Maps Ruby test files to TS test describe blocks.
 * Three layers: file-level mapping, description normalization, manual overrides.
 */

import * as path from "path";

// --- File-level mapping ---

export interface TsTestTarget {
  file: string;
  describeBlock: string;
}

type FileMap = Record<string, TsTestTarget[]>;

/**
 * Package-aware file map. Outer key = package name, inner key = Ruby file path.
 */
export const TEST_FILE_MAP: Record<string, FileMap> = {
  // ==========================================================================
  // Arel
  // ==========================================================================
  arel: {
    "table_test.rb": [
      { file: "arel.test.ts", describeBlock: "Table" },
      { file: "arel.test.ts", describeBlock: "Table.from()" },
      { file: "arel.test.ts", describeBlock: "Table factory methods" },
    ],
    "select_manager_test.rb": [
      { file: "arel.test.ts", describeBlock: "SelectManager" },
      { file: "arel.test.ts", describeBlock: "SelectManager join methods" },
      { file: "arel.test.ts", describeBlock: "SelectManager introspection" },
      { file: "arel.test.ts", describeBlock: "SelectManager joinSources" },
      { file: "arel.test.ts", describeBlock: "SelectManager froms" },
    ],
    "insert_manager_test.rb": [
      { file: "arel.test.ts", describeBlock: "InsertManager" },
      { file: "arel.test.ts", describeBlock: "InsertManager advanced" },
      { file: "arel.test.ts", describeBlock: "InsertManager columns getter" },
    ],
    "update_manager_test.rb": [
      { file: "arel.test.ts", describeBlock: "UpdateManager" },
      { file: "arel.test.ts", describeBlock: "UpdateManager advanced" },
      { file: "arel.test.ts", describeBlock: "UpdateManager introspection" },
    ],
    "delete_manager_test.rb": [
      { file: "arel.test.ts", describeBlock: "DeleteManager" },
      { file: "arel.test.ts", describeBlock: "DeleteManager advanced" },
      { file: "arel.test.ts", describeBlock: "DeleteManager introspection" },
    ],
    "attributes/attribute_test.rb": [
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
      { file: "arel.test.ts", describeBlock: "Attribute _any/_all variants" },
      { file: "arel.test.ts", describeBlock: "Additional _any/_all variants" },
      { file: "arel.test.ts", describeBlock: "Attribute string/null functions" },
      { file: "arel.test.ts", describeBlock: "Attribute string functions" },
      { file: "arel.test.ts", describeBlock: "Attribute math functions" },
      { file: "arel.test.ts", describeBlock: "Ordering" },
      { file: "arel.test.ts", describeBlock: "Math operations" },
    ],
    "attributes/math_test.rb": [
      { file: "arel.test.ts", describeBlock: "Math operations" },
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "attributes_test.rb": [
      { file: "arel.test.ts", describeBlock: "Attribute string/null functions" },
    ],
    "nodes/node_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/equality_test.rb": [
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
    ],
    "nodes/case_test.rb": [
      { file: "arel.test.ts", describeBlock: "Case node" },
    ],
    "nodes/extract_test.rb": [
      { file: "arel.test.ts", describeBlock: "Extract node" },
    ],
    "nodes/bind_param_test.rb": [
      { file: "arel.test.ts", describeBlock: "BindParam node" },
    ],
    "nodes/and_test.rb": [
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/as_test.rb": [
      { file: "arel.test.ts", describeBlock: "SelectManager introspection" },
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/ascending_test.rb": [
      { file: "arel.test.ts", describeBlock: "Ordering" },
    ],
    "nodes/descending_test.rb": [
      { file: "arel.test.ts", describeBlock: "Ordering" },
    ],
    "nodes/casted_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/count_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/cte_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/delete_statement_test.rb": [
      { file: "arel.test.ts", describeBlock: "DeleteManager" },
      { file: "arel.test.ts", describeBlock: "DeleteManager introspection" },
    ],
    "nodes/distinct_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "SelectManager" },
    ],
    "nodes/false_test.rb": [
      { file: "arel.test.ts", describeBlock: "True and False nodes" },
    ],
    "nodes/true_test.rb": [
      { file: "arel.test.ts", describeBlock: "True and False nodes" },
    ],
    "nodes/filter_test.rb": [
      { file: "arel.test.ts", describeBlock: "Window framing" },
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/grouping_test.rb": [
      { file: "arel.test.ts", describeBlock: "ToSql Visitor" },
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
    ],
    "nodes/infix_operation_test.rb": [
      { file: "arel.test.ts", describeBlock: "InfixOperation node" },
    ],
    "nodes/insert_statement_test.rb": [
      { file: "arel.test.ts", describeBlock: "InsertManager" },
      { file: "arel.test.ts", describeBlock: "InsertManager columns getter" },
    ],
    "nodes/named_function_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/not_test.rb": [
      { file: "arel.test.ts", describeBlock: "ToSql Visitor" },
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
    ],
    "nodes/or_test.rb": [
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
    ],
    "nodes/over_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Window framing" },
    ],
    "nodes/select_statement_test.rb": [
      { file: "arel.test.ts", describeBlock: "SelectManager" },
      { file: "arel.test.ts", describeBlock: "SelectManager introspection" },
    ],
    "nodes/sql_literal_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "ToSql Visitor" },
    ],
    "nodes/sum_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/table_alias_test.rb": [
      { file: "arel.test.ts", describeBlock: "Table factory methods" },
      { file: "arel.test.ts", describeBlock: "Table" },
    ],
    "nodes/unary_operation_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
    ],
    "nodes/update_statement_test.rb": [
      { file: "arel.test.ts", describeBlock: "UpdateManager" },
      { file: "arel.test.ts", describeBlock: "UpdateManager introspection" },
    ],
    "nodes/window_test.rb": [
      { file: "arel.test.ts", describeBlock: "Window framing" },
    ],
    "collectors/sql_string_test.rb": [
      { file: "arel.test.ts", describeBlock: "Collectors" },
    ],
    "collectors/bind_test.rb": [
      { file: "arel.test.ts", describeBlock: "Collectors" },
    ],
    "factory_methods_test.rb": [
      { file: "arel.test.ts", describeBlock: "Table factory methods" },
      { file: "arel.test.ts", describeBlock: "True and False nodes" },
    ],
    "visitors/to_sql_test.rb": [
      { file: "arel.test.ts", describeBlock: "ToSql Visitor" },
    ],
  },

  // ==========================================================================
  // ActiveModel
  // ==========================================================================
  activemodel: {
    "dirty_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Dirty Tracking" },
      { file: "activemodel.test.ts", describeBlock: "clearChangesInformation" },
      { file: "activemodel.test.ts", describeBlock: "clearAttributeChanges" },
      { file: "activemodel.test.ts", describeBlock: "changesToSave" },
      { file: "activemodel.test.ts", describeBlock: "attributesInDatabase" },
      { file: "activemodel.test.ts", describeBlock: "hasChangesToSave" },
      { file: "activemodel.test.ts", describeBlock: "attributeChanged with from/to options" },
      { file: "activemodel.test.ts", describeBlock: "willSaveChangeToAttribute" },
      { file: "activemodel.test.ts", describeBlock: "attributeInDatabase / attributeBeforeLastSave / changedAttributeNamesToSave" },
      { file: "activemodel.test.ts", describeBlock: "attributePreviouslyChanged / attributePreviouslyWas" },
    ],
    "validations_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validators (extended)" },
      { file: "activemodel.test.ts", describeBlock: "conditional validates (if/unless)" },
      { file: "activemodel.test.ts", describeBlock: "validates_*_of shorthand methods" },
      { file: "activemodel.test.ts", describeBlock: "strict validations" },
      { file: "activemodel.test.ts", describeBlock: "custom validation contexts" },
    ],
    "validations/presence_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
    ],
    "validations/length_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
    ],
    "validations/numericality_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "numericality with in: range" },
    ],
    "validations/inclusion_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
    ],
    "validations/exclusion_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
    ],
    "validations/format_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
    ],
    "validations/acceptance_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
    ],
    "validations/confirmation_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "ConfirmationValidator caseSensitive" },
    ],
    "validations/comparison_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "ComparisonValidator" },
    ],
    "validations/callbacks_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Callbacks" },
      { file: "activemodel.test.ts", describeBlock: "Callbacks (extended)" },
    ],
    "validations/absence_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "validates_*_of shorthand methods" },
    ],
    "validations/conditional_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "conditional validates (if/unless)" },
      { file: "activemodel.test.ts", describeBlock: "Validations" },
    ],
    "validations/validates_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validators (extended)" },
      { file: "activemodel.test.ts", describeBlock: "validates_*_of shorthand methods" },
      { file: "activemodel.test.ts", describeBlock: "withOptions()" },
    ],
    "validations/validations_context_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "custom validation contexts" },
    ],
    "validations/with_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "validatesWith" },
      { file: "activemodel.test.ts", describeBlock: "validatesEach" },
    ],
    "validations/i18n_generate_message_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Errors#generateMessage" },
    ],
    "errors_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Errors" },
      { file: "activemodel.test.ts", describeBlock: "Errors.on()" },
      { file: "activemodel.test.ts", describeBlock: "Errors enhancements" },
      { file: "activemodel.test.ts", describeBlock: "Errors#generateMessage" },
      { file: "activemodel.test.ts", describeBlock: "errors.fullMessagesFor()" },
      { file: "activemodel.test.ts", describeBlock: "errors.ofKind()" },
    ],
    "error_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Errors" },
      { file: "activemodel.test.ts", describeBlock: "Errors enhancements" },
      { file: "activemodel.test.ts", describeBlock: "Errors#generateMessage" },
    ],
    "nested_error_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Errors" },
      { file: "activemodel.test.ts", describeBlock: "Errors enhancements" },
    ],
    "callbacks_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Callbacks" },
      { file: "activemodel.test.ts", describeBlock: "Callbacks (extended)" },
      { file: "activemodel.test.ts", describeBlock: "callbacks with prepend option" },
    ],
    "naming_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Naming" },
      { file: "activemodel.test.ts", describeBlock: "humanAttributeName()" },
    ],
    "serialization_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Serialization" },
      { file: "activemodel.test.ts", describeBlock: "toXml()" },
      { file: "activemodel.test.ts", describeBlock: "fromJson" },
    ],
    "attributes_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "Types" },
      { file: "activemodel.test.ts", describeBlock: "attributeBeforeTypeCast" },
      { file: "activemodel.test.ts", describeBlock: "attributesBeforeTypeCast" },
      { file: "activemodel.test.ts", describeBlock: "hasAttribute" },
      { file: "activemodel.test.ts", describeBlock: "attributeNames (instance)" },
    ],
    "attribute_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "attributeBeforeTypeCast" },
      { file: "activemodel.test.ts", describeBlock: "Dirty Tracking" },
    ],
    "attribute_registration_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "Types" },
      { file: "activemodel.test.ts", describeBlock: "TypeRegistry" },
      { file: "activemodel.test.ts", describeBlock: "typeForAttribute" },
    ],
    "attribute_assignment_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
    ],
    "access_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
    ],
    "model_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "isPersisted" },
    ],
    "api_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "isPersisted" },
    ],
    "conversion_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "toModel" },
      { file: "activemodel.test.ts", describeBlock: "isPersisted" },
    ],
    "attribute_methods_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "respondTo" },
      { file: "activemodel.test.ts", describeBlock: "attribute method prefix/suffix/affix" },
      { file: "activemodel.test.ts", describeBlock: "attributeMissing" },
    ],
    "translation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "humanAttributeName()" },
      { file: "activemodel.test.ts", describeBlock: "Naming" },
      { file: "activemodel.test.ts", describeBlock: "i18nScope" },
    ],
    "type/string_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
    ],
    "type/integer_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
    ],
    "type/boolean_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
    ],
    "type/date_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "DateType" },
    ],
    "type/date_time_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "DateTimeType" },
    ],
    "type/decimal_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "DecimalType" },
    ],
    "type/registry_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "TypeRegistry" },
    ],
    "type/big_integer_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
    ],
    "type/float_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
    ],
    "type/time_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
    ],
    "type/value_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
    ],
    "type/immutable_string_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
    ],
  },

  // ==========================================================================
  // ActiveRecord
  // ==========================================================================
  activerecord: {
    "persistence_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "persistence" },
      { file: "rails-guided.test.ts", describeBlock: "Persistence (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Persistence edge cases (Rails-guided)" },
    ],
    "finder_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "finders" },
      { file: "rails-guided.test.ts", describeBlock: "Finders (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Finders edge cases (Rails-guided)" },
    ],
    "relations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "Relation (extended)" },
      { file: "activerecord.test.ts", describeBlock: "Relation edge cases" },
      { file: "activerecord.test.ts", describeBlock: "Relation: pick, first(n), last(n)" },
      { file: "activerecord.test.ts", describeBlock: "Relation: explain()" },
      { file: "activerecord.test.ts", describeBlock: "Relation: set operations" },
      { file: "activerecord.test.ts", describeBlock: "Relation: lock()" },
      { file: "activerecord.test.ts", describeBlock: "Relation state: isLoaded, reset, size, isEmpty, isAny, isMany" },
      { file: "activerecord.test.ts", describeBlock: "Relation#presence" },
      { file: "rails-guided.test.ts", describeBlock: "Relation (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Relation query edge cases (Rails-guided)" },
    ],
    "relation/where_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "where with Range" },
      { file: "rails-guided.test.ts", describeBlock: "where with Range (Rails-guided)" },
    ],
    "relation/or_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation#or" },
      { file: "rails-guided.test.ts", describeBlock: "Relation#or (Rails-guided)" },
    ],
    "relation/and_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "and()" },
    ],
    "relation/delete_all_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "destroyBy and deleteBy" },
      { file: "activerecord.test.ts", describeBlock: "Relation" },
    ],
    "relation/field_ordered_values_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "inOrderOf()" },
    ],
    "relation/order_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "regroup()" },
    ],
    "relation/select_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "select block form" },
      { file: "activerecord.test.ts", describeBlock: "Relation" },
    ],
    "relation/structural_compatibility_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "structurallyCompatible" },
    ],
    "relation/update_all_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "static updateAll" },
      { file: "activerecord.test.ts", describeBlock: "Bulk operations edge cases" },
    ],
    "relation/where_clause_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "where with Range" },
      { file: "activerecord.test.ts", describeBlock: "Relation" },
    ],
    "relation/with_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
    ],
    "calculations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Aggregations" },
      { file: "rails-guided.test.ts", describeBlock: "Calculations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Calculations edge cases (Rails-guided)" },
    ],
    "aggregations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Aggregations" },
      { file: "activerecord.test.ts", describeBlock: "grouped calculations" },
      { file: "rails-guided.test.ts", describeBlock: "Calculations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
    ],
    "scoping/default_scoping_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "default_scope / unscoped" },
      { file: "activerecord.test.ts", describeBlock: "unscope()" },
      { file: "rails-guided.test.ts", describeBlock: "default_scope / unscoped (Rails-guided)" },
    ],
    "scoping/named_scoping_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Scopes" },
      { file: "activerecord.test.ts", describeBlock: "Scope proxy" },
      { file: "activerecord.test.ts", describeBlock: "scoping()" },
      { file: "rails-guided.test.ts", describeBlock: "Scopes (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Scopes edge cases (Rails-guided)" },
    ],
    "scoping/relation_scoping_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "scoping()" },
      { file: "activerecord.test.ts", describeBlock: "Scopes" },
    ],
    "associations/belongs_to_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
    ],
    "associations/has_many_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
    ],
    "associations/has_one_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
    ],
    "associations/has_many_through_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations: has_many through" },
    ],
    "associations/has_and_belongs_to_many_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "has_and_belongs_to_many" },
      { file: "rails-guided.test.ts", describeBlock: "HABTM (Rails-guided)" },
    ],
    "associations/has_one_through_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "Associations: has_many through" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
    ],
    "associations/inner_join_association_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation: joins and leftJoins" },
    ],
    "associations/inverse_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "inverse_of" },
      { file: "rails-guided.test.ts", describeBlock: "inverse_of (Rails-guided)" },
    ],
    "associations/join_model_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "Relation: joins and leftJoins" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
    ],
    "associations/left_outer_join_association_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation: joins and leftJoins" },
    ],
    "associations/nested_through_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations: has_many through" },
    ],
    "associations/required_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "belongs_to required option" },
    ],
    "associations/callbacks_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "callbacks" },
    ],
    "associations/extension_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation#extending with function" },
      { file: "activerecord.test.ts", describeBlock: "scope with extension block" },
    ],
    "associations/eager_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Eager Loading" },
    ],
    "associations/cascaded_eager_loading_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Eager Loading" },
    ],
    "associations/bidirectional_destroy_dependencies_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations: dependent" },
    ],
    "associations/nested_error_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "acceptsNestedAttributesFor" },
    ],
    "associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "Associations: dependent" },
      { file: "activerecord.test.ts", describeBlock: "CollectionProxy" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
    ],
    "transactions_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Transactions" },
      { file: "rails-guided.test.ts", describeBlock: "Transactions (Rails-guided)" },
    ],
    "transaction_callbacks_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "afterCommit / afterRollback" },
    ],
    "callbacks_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "callbacks" },
      { file: "activerecord.test.ts", describeBlock: "Callbacks (extended)" },
      { file: "rails-guided.test.ts", describeBlock: "Callbacks (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Conditional Callbacks (Rails-guided)" },
    ],
    "timestamp_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Timestamps" },
      { file: "rails-guided.test.ts", describeBlock: "Timestamps (Rails-guided)" },
    ],
    "touch_later_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "touch" },
      { file: "activerecord.test.ts", describeBlock: "touch edge cases" },
      { file: "rails-guided.test.ts", describeBlock: "touch (Rails-guided)" },
    ],
    "batches_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "findEach / findInBatches" },
      { file: "rails-guided.test.ts", describeBlock: "find_each / find_in_batches (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Batches (Rails-guided)" },
    ],
    "enum_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Enum" },
      { file: "rails-guided.test.ts", describeBlock: "Enum (Rails-guided)" },
    ],
    "inheritance_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "STI" },
      { file: "rails-guided.test.ts", describeBlock: "STI (Rails-guided)" },
    ],
    "inherited_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "STI" },
    ],
    "locking_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "optimistic locking" },
      { file: "rails-guided.test.ts", describeBlock: "Optimistic Locking (Rails-guided)" },
    ],
    "custom_locking_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "optimistic locking" },
    ],
    "readonly_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "readonly" },
      { file: "rails-guided.test.ts", describeBlock: "Readonly (Rails-guided)" },
    ],
    "store_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Store" },
      { file: "rails-guided.test.ts", describeBlock: "Store (Rails-guided)" },
    ],
    "secure_password_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "secure_password" },
      { file: "rails-guided.test.ts", describeBlock: "SecurePassword (Rails-guided)" },
    ],
    "counter_cache_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "counter_cache" },
      { file: "rails-guided.test.ts", describeBlock: "Counter Cache (Rails-guided)" },
    ],
    "migration_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Migrations" },
      { file: "activerecord.test.ts", describeBlock: "Migration DDL (extended)" },
    ],
    "insert_all_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "insertAll / upsertAll" },
      { file: "rails-guided.test.ts", describeBlock: "insertAll / upsertAll (Rails-guided)" },
    ],
    "reflection_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "reflection" },
      { file: "rails-guided.test.ts", describeBlock: "Reflection (Rails-guided)" },
    ],
    "nested_attributes_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "acceptsNestedAttributesFor" },
      { file: "rails-guided.test.ts", describeBlock: "Nested Attributes (Rails-guided)" },
    ],
    "nested_attributes_with_callbacks_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "acceptsNestedAttributesFor" },
    ],
    "secure_token_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "has_secure_token" },
      { file: "rails-guided.test.ts", describeBlock: "has_secure_token (Rails-guided)" },
    ],
    "serialized_attribute_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "serialize" },
      { file: "rails-guided.test.ts", describeBlock: "serialize (Rails-guided)" },
    ],
    "validations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "validations" },
      { file: "activerecord.test.ts", describeBlock: "validation contexts" },
    ],
    "validations/uniqueness_validation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "UniquenessValidator" },
    ],
    "validations/presence_validation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "validations" },
    ],
    "validations/length_validation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "validations" },
    ],
    "validations/numericality_validation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "validations" },
    ],
    "validations/absence_validation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "validations" },
    ],
    "validations/association_validation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "validations" },
      { file: "activerecord.test.ts", describeBlock: "Associations" },
    ],
    "attributes_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "hasAttribute()" },
      { file: "activerecord.test.ts", describeBlock: "attributeNames()" },
      { file: "activerecord.test.ts", describeBlock: "Base.attributeTypes" },
    ],
    "attribute_methods_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "hasAttribute()" },
      { file: "activerecord.test.ts", describeBlock: "attributeNames()" },
      { file: "activerecord.test.ts", describeBlock: "humanAttributeName" },
      { file: "activerecord.test.ts", describeBlock: "attributePresent()" },
      { file: "activerecord.test.ts", describeBlock: "attributesBeforeTypeCast on Base" },
      { file: "activerecord.test.ts", describeBlock: "columnForAttribute on Base" },
    ],
    "cache_key_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "cacheKey / cacheKeyWithVersion" },
    ],
    "excluding_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "excluding() / without()" },
    ],
    "errors_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "error classes" },
    ],
    "finder_respond_to_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "finders" },
      { file: "activerecord.test.ts", describeBlock: "Base.respondToMissingFinder" },
    ],
    "normalized_attribute_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "normalizes on Base" },
    ],
    "annotate_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "annotate()" },
    ],
    "habtm_destroy_order_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "has_and_belongs_to_many" },
    ],
    "boolean_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Base" },
    ],
    "persistence/reload_association_cache_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "persistence" },
    ],
    "base_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Base" },
      { file: "activerecord.test.ts", describeBlock: "Base (extended)" },
      { file: "activerecord.test.ts", describeBlock: "record state" },
      { file: "activerecord.test.ts", describeBlock: "toParam" },
      { file: "activerecord.test.ts", describeBlock: "table name inference" },
      { file: "activerecord.test.ts", describeBlock: "primary key" },
      { file: "activerecord.test.ts", describeBlock: "Base.new()" },
      { file: "activerecord.test.ts", describeBlock: "Base.exists" },
      { file: "activerecord.test.ts", describeBlock: "inspect()" },
      { file: "activerecord.test.ts", describeBlock: "isBlank / isPresent" },
      { file: "activerecord.test.ts", describeBlock: "frozen / isFrozen" },
      { file: "activerecord.test.ts", describeBlock: "abstract_class" },
      { file: "activerecord.test.ts", describeBlock: "table_name_prefix and table_name_suffix" },
      { file: "activerecord.test.ts", describeBlock: "Base#clone" },
      { file: "activerecord.test.ts", describeBlock: "ignoredColumns" },
      { file: "activerecord.test.ts", describeBlock: "Base.columnDefaults" },
      { file: "activerecord.test.ts", describeBlock: "Base.columnsHash" },
      { file: "activerecord.test.ts", describeBlock: "Base.contentColumns" },
      { file: "activerecord.test.ts", describeBlock: "Base.inheritanceColumn" },
    ],
    "autosave_association_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "isChangedForAutosave" },
      { file: "activerecord.test.ts", describeBlock: "acceptsNestedAttributesFor" },
    ],
    "dirty_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "dirty tracking: attributeInDatabase, attributeBeforeLastSave" },
      { file: "activerecord.test.ts", describeBlock: "savedChanges" },
      { file: "activerecord.test.ts", describeBlock: "previouslyNewRecord" },
      { file: "activerecord.test.ts", describeBlock: "attributeChanged with from/to options" },
    ],
    "relation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "Relation (extended)" },
      { file: "activerecord.test.ts", describeBlock: "Relation edge cases" },
      { file: "activerecord.test.ts", describeBlock: "Relation state: isLoaded, reset, size, isEmpty, isAny, isMany" },
      { file: "activerecord.test.ts", describeBlock: "Relation#presence" },
      { file: "activerecord.test.ts", describeBlock: "Relation reload and records" },
      { file: "activerecord.test.ts", describeBlock: "Relation#inspect" },
      { file: "activerecord.test.ts", describeBlock: "Relation spawn/build/create" },
      { file: "activerecord.test.ts", describeBlock: "Relation value accessors" },
      { file: "activerecord.test.ts", describeBlock: "Relation collection convenience methods" },
      { file: "activerecord.test.ts", describeBlock: "Relation#toArel" },
      { file: "activerecord.test.ts", describeBlock: "load()" },
      { file: "activerecord.test.ts", describeBlock: "length()" },
    ],
    "relation/where_chain_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "where with Range" },
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "Relation#invertWhere" },
      { file: "activerecord.test.ts", describeBlock: "where with raw SQL" },
      { file: "activerecord.test.ts", describeBlock: "whereAssociated / whereMissing" },
      { file: "activerecord.test.ts", describeBlock: "where with subquery" },
      { file: "activerecord.test.ts", describeBlock: "where with named binds" },
      { file: "activerecord.test.ts", describeBlock: "whereAny, whereAll" },
    ],
    "relation/merging_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "merge()" },
      { file: "activerecord.test.ts", describeBlock: "Relation" },
    ],
    "relation/mutation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "Relation (extended)" },
    ],
    "relation/delegation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "Base static query delegations" },
    ],
    "strict_loading_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "strict_loading" },
      { file: "activerecord.test.ts", describeBlock: "strictLoadingByDefault" },
    ],
    "primary_keys_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "primary key" },
      { file: "activerecord.test.ts", describeBlock: "Base" },
    ],
    "signed_id_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "signedId / findSigned / findSignedBang" },
    ],
    "dup_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "dup()" },
      { file: "activerecord.test.ts", describeBlock: "becomes()" },
    ],
    "null_relation_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "Relation edge cases" },
    ],
    "explain_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation: explain()" },
    ],
    "delegated_type_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "delegate" },
      { file: "rails-guided.test.ts", describeBlock: "Delegate (Rails-guided)" },
    ],
    "modules_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Base" },
      { file: "activerecord.test.ts", describeBlock: "table name inference" },
    ],
    "clone_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Base#clone" },
    ],
    "serialization_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "toXml() on Base" },
      { file: "activerecord.test.ts", describeBlock: "serializableHash with include" },
      { file: "activerecord.test.ts", describeBlock: "fromJson on Base" },
    ],
    "json_serialization_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "fromJson on Base" },
      { file: "activerecord.test.ts", describeBlock: "toXml() on Base" },
      { file: "activerecord.test.ts", describeBlock: "serializableHash with include" },
    ],
    "sanitize_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "sanitizeSql" },
    ],
    "defaults_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Base" },
      { file: "activerecord.test.ts", describeBlock: "Base.columnDefaults" },
    ],
    "comment_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "annotate()" },
      { file: "activerecord.test.ts", describeBlock: "optimizerHints()" },
    ],
    "token_for_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "generatesTokenFor()" },
    ],
    "core_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Base" },
      { file: "activerecord.test.ts", describeBlock: "inspect()" },
      { file: "activerecord.test.ts", describeBlock: "Base#clone" },
      { file: "activerecord.test.ts", describeBlock: "Base.logger" },
      { file: "activerecord.test.ts", describeBlock: "Base#isEqual" },
    ],
    "suppressor_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "suppress()" },
    ],
    "active_record_schema_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Schema.define" },
    ],
  },
};

// --- Skip list ---

/** Files that are Ruby-internal with no TS equivalent. Exact basename match. */
export const SKIP_FILES: string[] = [
  // --- Infrastructure / helpers (all packages) ---
  "helper.rb",
  "abstract_unit.rb",
  "test_case.rb",

  // --- Arel skips ---
  "collectors/composite_test.rb",
  "collectors/substitute_bind_collector_test.rb",
  "crud_test.rb",
  "nodes/bin_test.rb",
  "nodes/bound_sql_literal_test.rb",
  "nodes/fragments_test.rb",
  "nodes/homogeneous_in_test.rb",
  "nodes_test.rb",
  "nodes/select_core_test.rb",
  "nodes/binary_test.rb",
  "nodes/comment_test.rb",
  "visitors/dispatch_contamination_test.rb",
  "visitors/dot_test.rb",
  "visitors/mysql_test.rb",
  "visitors/postgres_test.rb",
  "visitors/sqlite_test.rb",

  // --- ActiveModel skips ---
  "railtie_test.rb",
  "forbidden_attributes_protection_test.rb",
  "type/serialize_cast_value_test.rb",
  "validations/i18n_validation_test.rb",
  "secure_password_test.rb",
  "attribute_set_test.rb",
  "type/binary_test.rb",
  "type_test.rb",

  // --- ActiveRecord skips ---
  // Adapters / Connection infrastructure
  "active_record_test.rb",
  "adapter_prevent_writes_test.rb",
  "adapter_test.rb",
  "base_prevent_writes_test.rb",
  "connection_handling_test.rb",
  "connection_management_test.rb",
  "connection_pool_test.rb",
  "invalid_connection_test.rb",
  "database_configurations/hash_config_test.rb",
  "database_configurations/resolver_test.rb",
  "database_configurations/url_config_test.rb",
  "database_selector_test.rb",
  "database_statements_test.rb",
  // Fixtures
  "fixture_set/file_test.rb",
  "fixtures_test.rb",
  // Instrumentation / Logging
  "instrumentation_test.rb",
  "transaction_instrumentation_test.rb",
  // Type system internals
  "type/adapter_specific_registry_test.rb",
  "type/type_map_test.rb",
  "type/unsigned_integer_test.rb",
  "type_caster/connection_test.rb",
  // i18n
  "validations/i18n_generate_message_validation_test.rb",
  // DB-specific behavior
  "bind_parameter_test.rb",
  "date_test.rb",
  "date_time_test.rb",
  "time_precision_test.rb",
  "prepared_statement_status_test.rb",
  "transaction_isolation_test.rb",
  "unsafe_raw_sql_test.rb",
  // Other infrastructure / internal
  "assertions/query_assertions_test.rb",
  "asynchronous_queries_test.rb",
  "collection_cache_key_test.rb",
  "column_alias_test.rb",
  "filter_attributes_test.rb",
  "hot_compatibility_test.rb",
  "integration_test.rb",
  "marshal_serialization_test.rb",
  "mixin_test.rb",
  "multiparameter_attributes_test.rb",
  "primary_class_test.rb",
  "reaper_test.rb",
  "relation/load_async_test.rb",
  "relation/predicate_builder_test.rb",
  "reserved_word_test.rb",
  "result_test.rb",
  "schema_loading_test.rb",
  "shard_keys_test.rb",
  "shard_selector_test.rb",
  "statement_invalid_test.rb",
  "table_metadata_test.rb",
  "test_databases_test.rb",
  "view_test.rb",
  // Eager loading sub-files (DB-specific strategies)
  "associations/eager_load_includes_full_sti_class_test.rb",
  "associations/eager_load_nested_include_test.rb",
  "associations/eager_singularization_test.rb",
  "associations/has_many_through_disable_joins_associations_test.rb",
  "associations/has_one_through_disable_joins_associations_test.rb",
  // Query cache / statement cache
  "query_cache_test.rb",
  "statement_cache_test.rb",
  // Schema dumper
  "schema_dumper_test.rb",
  // Quoting / DB-specific
  "quoting_test.rb",
  "date_time_precision_test.rb",
  "numeric_data_test.rb",
  "binary_test.rb",
  "column_definition_test.rb",
  // Migrator internals
  "migrator_test.rb",
  "multi_db_migrator_test.rb",
  // Logging / instrumentation
  "query_logs_test.rb",
  "log_subscriber_test.rb",
  "explain_subscriber_test.rb",
  // i18n
  "i18n_test.rb",
  // Multiple DBs / connection pooling
  "multiple_db_test.rb",
  "database_configurations_test.rb",
  "pooled_connections_test.rb",
  "unconnected_test.rb",
  "disconnected_test.rb",
  // Serialization formats
  "yaml_serialization_test.rb",
  "message_pack_test.rb",
  // Test infrastructure
  "test_fixtures_test.rb",
  "reload_models_test.rb",
  // Type system internals
  "type_test.rb",
  "types_test.rb",
  "type/integer_test.rb",
  "type/time_test.rb",
  "type/string_test.rb",
];

/** Directory patterns to skip (checked with includes()) */
export const SKIP_DIRS: string[] = [
  "adapters/",
  "connection_adapters/",
  "migration/",
  "attribute_methods/",
  "coders/",
  "connection_pool/",
  "connection_specification/",
  "tasks/",
  "fixtures/",
  "encryption/",
];

// --- Description normalization ---

/** Common verb synonyms for normalization */
const VERB_SYNONYMS: Record<string, string> = {
  "creates": "create",
  "returns": "return",
  "generates": "generate",
  "produces": "produce",
  "handles": "handle",
  "takes": "take",
  "accepts": "accept",
  "adds": "add",
  "removes": "remove",
  "raises": "raise",
  "throws": "throw",
  "sets": "set",
  "gets": "get",
  "finds": "find",
  "makes": "make",
  "has": "have",
  "does": "do",
  "is": "be",
  "are": "be",
  "was": "be",
  "were": "be",
};

/**
 * Normalizes a test description for fuzzy matching.
 * Strips common prefixes, normalizes whitespace, lowercases, etc.
 */
export function normalizeTestDescription(desc: string): string {
  let normalized = desc
    // Split camelCase into words (notEq → not Eq, doesNotMatch → does Not Match)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Lowercase
    .toLowerCase()
    // Strip common prefixes (may appear multiple times)
    .replace(/^(should |it |test |must |can |will |does )/, "")
    .replace(/^(should |it |test |must |can |will |does )/, "")
    // Remove punctuation except hyphens and /
    .replace(/['"`.,:;!?()[\]{}#@*=<>]/g, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Convert snake_case to space-separated
  normalized = normalized.replace(/_/g, " ");

  // Normalize common verbs to base form
  normalized = normalized
    .split(" ")
    .map((word) => VERB_SYNONYMS[word] || word)
    .join(" ");

  // Normalize common Rails → TS term mappings
  normalized = normalized
    .replace(/\bsql literal\b/g, "sqlliteral")
    .replace(/\bsql\b/g, "")
    .replace(/\bnot equal\b/g, "noteq")
    .replace(/\bnot eq\b/g, "noteq")
    .replace(/\bgreater than or equal\b/g, "gteq")
    .replace(/\bgreater than\b/g, "gt")
    .replace(/\bless than or equal\b/g, "lteq")
    .replace(/\bless than\b/g, "lt")
    .replace(/\bnode\b/g, "")
    .replace(/\bgenerate\b/g, "")
    .replace(/\bproduce\b/g, "")
    .replace(/\bcreate\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

/**
 * Checks if two normalized descriptions match fuzzily.
 * Returns match confidence.
 */
export function matchDescriptions(
  rubyDesc: string,
  tsDesc: string,
): "exact" | "normalized" | "fuzzy" | "none" {
  // Exact match
  if (rubyDesc === tsDesc) return "exact";

  const rubyNorm = normalizeTestDescription(rubyDesc);
  const tsNorm = normalizeTestDescription(tsDesc);

  // Normalized exact match
  if (rubyNorm === tsNorm) return "normalized";

  // Fuzzy containment — one contains the other
  if (rubyNorm.includes(tsNorm) || tsNorm.includes(rubyNorm)) {
    // Only if the shorter is at least 60% of the longer
    const shorter = rubyNorm.length < tsNorm.length ? rubyNorm : tsNorm;
    const longer = rubyNorm.length >= tsNorm.length ? rubyNorm : tsNorm;
    if (shorter.length / longer.length >= 0.6) {
      return "fuzzy";
    }
  }

  // Word overlap — check if domain-specific words match (exclude stopwords)
  const STOPWORDS = new Set([
    "the", "and", "for", "with", "from", "that", "this", "not", "but",
    "all", "are", "can", "one", "new", "its", "when", "record", "value",
    "attribute", "given", "only", "also", "into", "will", "nil", "null",
  ]);
  const domainWords = (s: string) =>
    new Set(s.split(" ").filter(w => w.length > 2 && !STOPWORDS.has(w)));
  const rubyWords = domainWords(rubyNorm);
  const tsWords = domainWords(tsNorm);
  if (rubyWords.size >= 2 && tsWords.size >= 2) {
    let matches = 0;
    for (const word of rubyWords) {
      if (tsWords.has(word)) matches++;
    }
    const overlapRatio = matches / Math.max(rubyWords.size, tsWords.size);
    if (overlapRatio >= 0.6 && matches >= 3) return "fuzzy";
  }

  return "none";
}

// --- Lookup helper ---

/**
 * Find TS test targets for a given Ruby test file within a package.
 */
export function findTsTargets(
  rubyFile: string,
  pkg: string,
): TsTestTarget[] {
  const pkgMap = TEST_FILE_MAP[pkg];
  if (!pkgMap) return [];

  // Try exact path match
  if (pkgMap[rubyFile]) return pkgMap[rubyFile];

  // Try basename
  const basename = path.basename(rubyFile);
  if (pkgMap[basename]) return pkgMap[basename];

  // Try endsWith for partial paths
  for (const [key, targets] of Object.entries(pkgMap)) {
    if (rubyFile.endsWith(key)) return targets;
  }

  return [];
}

/**
 * Check if a file should be skipped.
 */
export function shouldSkipFile(file: string): boolean {
  const basename = path.basename(file);

  // Check exact file matches
  if (SKIP_FILES.includes(basename) || SKIP_FILES.includes(file)) {
    return true;
  }

  // Check directory patterns
  return SKIP_DIRS.some((dir) => file.includes(dir));
}

// --- Manual overrides ---

/**
 * Manual overrides for test descriptions that don't normalize to a match.
 * Key: Ruby test path (ancestors > description)
 * Value: TS test path, or null to skip
 */
export const TEST_OVERRIDES: Record<string, string | null> = {
  // Ruby-internal tests with no TS equivalent
  // (add specific overrides as needed when running the pipeline)
};
