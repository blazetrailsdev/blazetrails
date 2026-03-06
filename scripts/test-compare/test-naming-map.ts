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
      { file: "arel.test.ts", describeBlock: "Table (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Table (additional)" },
      { file: "arel.test.ts", describeBlock: "Table join (additional)" },
    ],
    "select_manager_test.rb": [
      { file: "arel.test.ts", describeBlock: "SelectManager" },
      { file: "arel.test.ts", describeBlock: "SelectManager join methods" },
      { file: "arel.test.ts", describeBlock: "SelectManager introspection" },
      { file: "arel.test.ts", describeBlock: "SelectManager joinSources" },
      { file: "arel.test.ts", describeBlock: "SelectManager froms" },
      { file: "arel.test.ts", describeBlock: "Select Manager (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "SelectManager (additional)" },
      { file: "arel.test.ts", describeBlock: "SelectManager (more missing)" },
      { file: "arel.test.ts", describeBlock: "SelectManager (class and join)" },
    ],
    "insert_manager_test.rb": [
      { file: "arel.test.ts", describeBlock: "InsertManager" },
      { file: "arel.test.ts", describeBlock: "InsertManager advanced" },
      { file: "arel.test.ts", describeBlock: "InsertManager columns getter" },
      { file: "arel.test.ts", describeBlock: "Insert Manager (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "InsertManager (additional)" },
    ],
    "update_manager_test.rb": [
      { file: "arel.test.ts", describeBlock: "UpdateManager" },
      { file: "arel.test.ts", describeBlock: "UpdateManager advanced" },
      { file: "arel.test.ts", describeBlock: "UpdateManager introspection" },
      { file: "arel.test.ts", describeBlock: "Update Manager (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "UpdateManager (additional)" },
    ],
    "delete_manager_test.rb": [
      { file: "arel.test.ts", describeBlock: "DeleteManager" },
      { file: "arel.test.ts", describeBlock: "DeleteManager advanced" },
      { file: "arel.test.ts", describeBlock: "DeleteManager introspection" },
      { file: "arel.test.ts", describeBlock: "Delete Manager (ported stubs)" },
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
      { file: "arel.test.ts", describeBlock: "Attributes Attribute (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (gt)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (gteq)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (lt)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (lteq)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (eq)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (matches)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (doesNotMatch)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (in)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (notIn)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (contains)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (between)" },
      { file: "arel.test.ts", describeBlock: "Attributes Attribute Predicates (notBetween)" },
      { file: "arel.test.ts", describeBlock: "Attribute between (range variants)" },
    ],
    "attributes/math_test.rb": [
      { file: "arel.test.ts", describeBlock: "Math operations" },
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Attributes Math (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Attributes Math (additional)" },
    ],
    "attributes_test.rb": [
      { file: "arel.test.ts", describeBlock: "Attribute string/null functions" },
      { file: "arel.test.ts", describeBlock: "Attributes (ported stubs)" },
    ],
    "nodes/node_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes Node (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes Node (additional)" },
      { file: "arel.test.ts", describeBlock: "Nodes Node" },
    ],
    "nodes/equality_test.rb": [
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
      { file: "arel.test.ts", describeBlock: "Nodes Equality (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes Equality" },
    ],
    "nodes/case_test.rb": [
      { file: "arel.test.ts", describeBlock: "Case node" },
      { file: "arel.test.ts", describeBlock: "Nodes Case (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes Case" },
    ],
    "nodes/extract_test.rb": [
      { file: "arel.test.ts", describeBlock: "Extract node" },
      { file: "arel.test.ts", describeBlock: "Nodes Extract (ported stubs)" },
    ],
    "nodes/bind_param_test.rb": [
      { file: "arel.test.ts", describeBlock: "BindParam node" },
      { file: "arel.test.ts", describeBlock: "Nodes BindParam (ported stubs)" },
    ],
    "nodes/and_test.rb": [
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes And (ported stubs)" },
    ],
    "nodes/as_test.rb": [
      { file: "arel.test.ts", describeBlock: "SelectManager introspection" },
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes As (ported stubs)" },
    ],
    "nodes/ascending_test.rb": [
      { file: "arel.test.ts", describeBlock: "Ordering" },
      { file: "arel.test.ts", describeBlock: "Nodes Ascending (ported stubs)" },
    ],
    "nodes/descending_test.rb": [
      { file: "arel.test.ts", describeBlock: "Ordering" },
      { file: "arel.test.ts", describeBlock: "Nodes Descending (ported stubs)" },
    ],
    "nodes/casted_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes Casted (ported stubs)" },
    ],
    "nodes/count_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes Count (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes Count" },
    ],
    "nodes/cte_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes Cte (ported stubs)" },
    ],
    "nodes/delete_statement_test.rb": [
      { file: "arel.test.ts", describeBlock: "DeleteManager" },
      { file: "arel.test.ts", describeBlock: "DeleteManager introspection" },
      { file: "arel.test.ts", describeBlock: "Nodes Delete Statement (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes DeleteStatement" },
    ],
    "nodes/distinct_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "SelectManager" },
      { file: "arel.test.ts", describeBlock: "Nodes Distinct (ported stubs)" },
    ],
    "nodes/false_test.rb": [
      { file: "arel.test.ts", describeBlock: "True and False nodes" },
      { file: "arel.test.ts", describeBlock: "Nodes False (ported stubs)" },
    ],
    "nodes/true_test.rb": [
      { file: "arel.test.ts", describeBlock: "True and False nodes" },
      { file: "arel.test.ts", describeBlock: "Nodes True (ported stubs)" },
    ],
    "nodes/filter_test.rb": [
      { file: "arel.test.ts", describeBlock: "Window framing" },
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes Filter (ported stubs)" },
    ],
    "nodes/grouping_test.rb": [
      { file: "arel.test.ts", describeBlock: "ToSql Visitor" },
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
      { file: "arel.test.ts", describeBlock: "Nodes Grouping (ported stubs)" },
    ],
    "nodes/infix_operation_test.rb": [
      { file: "arel.test.ts", describeBlock: "InfixOperation node" },
      { file: "arel.test.ts", describeBlock: "Nodes InfixOperation (ported stubs)" },
    ],
    "nodes/insert_statement_test.rb": [
      { file: "arel.test.ts", describeBlock: "InsertManager" },
      { file: "arel.test.ts", describeBlock: "InsertManager columns getter" },
      { file: "arel.test.ts", describeBlock: "Nodes Insert Statement (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes InsertStatement" },
    ],
    "nodes/named_function_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes Named Function (ported stubs)" },
    ],
    "nodes/not_test.rb": [
      { file: "arel.test.ts", describeBlock: "ToSql Visitor" },
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
      { file: "arel.test.ts", describeBlock: "Nodes Not (ported stubs)" },
    ],
    "nodes/or_test.rb": [
      { file: "arel.test.ts", describeBlock: "Attribute predicates" },
      { file: "arel.test.ts", describeBlock: "Nodes Or (ported stubs)" },
    ],
    "nodes/over_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Window framing" },
      { file: "arel.test.ts", describeBlock: "Nodes Over (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes Over" },
    ],
    "nodes/select_statement_test.rb": [
      { file: "arel.test.ts", describeBlock: "SelectManager" },
      { file: "arel.test.ts", describeBlock: "SelectManager introspection" },
      { file: "arel.test.ts", describeBlock: "Nodes Select Statement (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes SelectStatement" },
    ],
    "nodes/sql_literal_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "ToSql Visitor" },
      { file: "arel.test.ts", describeBlock: "Nodes Sql Literal (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes Sql Literal (additional)" },
      { file: "arel.test.ts", describeBlock: "Nodes SqlLiteral" },
      { file: "arel.test.ts", describeBlock: "Nodes SqlLiteral (additional2)" },
    ],
    "nodes/sum_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes Sum (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes Sum" },
    ],
    "nodes/table_alias_test.rb": [
      { file: "arel.test.ts", describeBlock: "Table factory methods" },
      { file: "arel.test.ts", describeBlock: "Table" },
      { file: "arel.test.ts", describeBlock: "Nodes Table Alias (ported stubs)" },
    ],
    "nodes/unary_operation_test.rb": [
      { file: "arel.test.ts", describeBlock: "Advanced" },
      { file: "arel.test.ts", describeBlock: "Nodes Unary Operation (ported stubs)" },
    ],
    "nodes/update_statement_test.rb": [
      { file: "arel.test.ts", describeBlock: "UpdateManager" },
      { file: "arel.test.ts", describeBlock: "UpdateManager introspection" },
      { file: "arel.test.ts", describeBlock: "Nodes Update Statement (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes UpdateStatement" },
    ],
    "nodes/window_test.rb": [
      { file: "arel.test.ts", describeBlock: "Window framing" },
      { file: "arel.test.ts", describeBlock: "Nodes Window (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Nodes Window" },
    ],
    "collectors/sql_string_test.rb": [
      { file: "arel.test.ts", describeBlock: "Collectors" },
      { file: "arel.test.ts", describeBlock: "Collectors (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Collectors SqlString" },
    ],
    "collectors/bind_test.rb": [
      { file: "arel.test.ts", describeBlock: "Collectors" },
      { file: "arel.test.ts", describeBlock: "Collectors (ported stubs)" },
    ],
    "factory_methods_test.rb": [
      { file: "arel.test.ts", describeBlock: "Table factory methods" },
      { file: "arel.test.ts", describeBlock: "True and False nodes" },
      { file: "arel.test.ts", describeBlock: "Factory Methods (ported stubs)" },
    ],
    "visitors/to_sql_test.rb": [
      { file: "arel.test.ts", describeBlock: "ToSql Visitor" },
      { file: "arel.test.ts", describeBlock: "Visitors To Sql (ported stubs)" },
      { file: "arel.test.ts", describeBlock: "Visitors To Sql (additional)" },
      { file: "arel.test.ts", describeBlock: "Visitors ToSql (additional)" },
      { file: "arel.test.ts", describeBlock: "Visitors ToSql (In context)" },
      { file: "arel.test.ts", describeBlock: "Visitors ToSql (NotIn context)" },
      { file: "arel.test.ts", describeBlock: "Visitors ToSql (BindParam)" },
      { file: "arel.test.ts", describeBlock: "Visitors ToSql (BoundSqlLiteral)" },
      { file: "arel.test.ts", describeBlock: "Visitors ToSql (retryable)" },
    ],
  },

  // ==========================================================================
  // ActiveModel
  // ==========================================================================
  activemodel: {
    "dirty_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Dirty Tracking" },
      { file: "activemodel.test.ts", describeBlock: "Dirty (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Dirty (advanced)" },
      { file: "activemodel.test.ts", describeBlock: "Dirty JSON tests" },
      { file: "activemodel.test.ts", describeBlock: "clearChangesInformation" },
      { file: "activemodel.test.ts", describeBlock: "clearAttributeChanges" },
      { file: "activemodel.test.ts", describeBlock: "changesToSave" },
      { file: "activemodel.test.ts", describeBlock: "attributesInDatabase" },
      { file: "activemodel.test.ts", describeBlock: "hasChangesToSave" },
      { file: "activemodel.test.ts", describeBlock: "attributeChanged with from/to options" },
      { file: "activemodel.test.ts", describeBlock: "willSaveChangeToAttribute" },
      { file: "activemodel.test.ts", describeBlock: "attributeInDatabase / attributeBeforeLastSave / changedAttributeNamesToSave" },
      { file: "activemodel.test.ts", describeBlock: "attributePreviouslyChanged / attributePreviouslyWas" },
      { file: "activemodel.test.ts", describeBlock: "DirtyTest" },
    ],
    "attributes_dirty_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Dirty (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Dirty (advanced)" },
      { file: "activemodel.test.ts", describeBlock: "Dirty Tracking" },
      { file: "activemodel.test.ts", describeBlock: "AttributesDirtyTest" },
    ],
    "validations_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Validations (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "Validators (extended)" },
      { file: "activemodel.test.ts", describeBlock: "conditional validates (if/unless)" },
      { file: "activemodel.test.ts", describeBlock: "validates_*_of shorthand methods" },
      { file: "activemodel.test.ts", describeBlock: "strict validations" },
      { file: "activemodel.test.ts", describeBlock: "custom validation contexts" },
      { file: "activemodel.test.ts", describeBlock: "ValidationsTest" },
    ],
    "validations/presence_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Presence (ported)" },
      { file: "activemodel.test.ts", describeBlock: "PresenceValidationTest" },
    ],
    "validations/length_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Length (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Validations (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "LengthValidationTest" },
    ],
    "validations/numericality_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Numericality (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Validators (extended)" },
      { file: "activemodel.test.ts", describeBlock: "Validations (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "numericality with in: range" },
      { file: "activemodel.test.ts", describeBlock: "NumericalityValidationTest" },
    ],
    "validations/inclusion_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Inclusion (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Validations (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "InclusionValidationTest" },
    ],
    "validations/exclusion_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Exclusion (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Validations (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "ExclusionValidationTest" },
    ],
    "validations/format_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Format (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Validations (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "FormatValidationTest" },
    ],
    "validations/acceptance_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Acceptance (ported)" },
      { file: "activemodel.test.ts", describeBlock: "AcceptanceValidationTest" },
    ],
    "validations/confirmation_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Confirmation (ported)" },
      { file: "activemodel.test.ts", describeBlock: "ConfirmationValidator caseSensitive" },
      { file: "activemodel.test.ts", describeBlock: "ConfirmationValidationTest" },
    ],
    "validations/comparison_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "ComparisonValidator" },
      { file: "activemodel.test.ts", describeBlock: "Validations Comparison (ported)" },
      { file: "activemodel.test.ts", describeBlock: "ComparisonValidationTest" },
    ],
    "validations/callbacks_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Callbacks" },
      { file: "activemodel.test.ts", describeBlock: "Callbacks (extended)" },
      { file: "activemodel.test.ts", describeBlock: "Validations Callbacks (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Callbacks (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "CallbacksWithMethodNamesShouldBeCalled" },
    ],
    "validations/absence_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Absence (ported)" },
      { file: "activemodel.test.ts", describeBlock: "validates_*_of shorthand methods" },
      { file: "activemodel.test.ts", describeBlock: "AbsenceValidationTest" },
    ],
    "validations/conditional_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "conditional validates (if/unless)" },
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Conditional (ported)" },
    ],
    "validations/validates_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Validations" },
      { file: "activemodel.test.ts", describeBlock: "Validations Validates (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Validations (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "Validators (extended)" },
      { file: "activemodel.test.ts", describeBlock: "validates_*_of shorthand methods" },
      { file: "activemodel.test.ts", describeBlock: "withOptions()" },
      { file: "activemodel.test.ts", describeBlock: "ValidatesTest" },
    ],
    "validations/validations_context_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "custom validation contexts" },
      { file: "activemodel.test.ts", describeBlock: "Validations Context (ported)" },
    ],
    "validations/with_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "validatesWith" },
      { file: "activemodel.test.ts", describeBlock: "validatesEach" },
      { file: "activemodel.test.ts", describeBlock: "Validations With Validation (ported)" },
      { file: "activemodel.test.ts", describeBlock: "ValidatesWithTest" },
    ],
    "validations/i18n_generate_message_validation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Errors#generateMessage" },
    ],
    "errors_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Errors" },
      { file: "activemodel.test.ts", describeBlock: "Errors (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Errors (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "Errors.on()" },
      { file: "activemodel.test.ts", describeBlock: "Errors enhancements" },
      { file: "activemodel.test.ts", describeBlock: "Errors#generateMessage" },
      { file: "activemodel.test.ts", describeBlock: "errors.fullMessagesFor()" },
      { file: "activemodel.test.ts", describeBlock: "errors.ofKind()" },
      { file: "activemodel.test.ts", describeBlock: "ErrorsTest" },
    ],
    "error_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Errors" },
      { file: "activemodel.test.ts", describeBlock: "Error (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Errors (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "Errors enhancements" },
      { file: "activemodel.test.ts", describeBlock: "Errors#generateMessage" },
      { file: "activemodel.test.ts", describeBlock: "ErrorTest" },
    ],
    "nested_error_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Errors" },
      { file: "activemodel.test.ts", describeBlock: "NestedError" },
      { file: "activemodel.test.ts", describeBlock: "NestedErrorTest" },
      { file: "activemodel.test.ts", describeBlock: "Errors enhancements" },
    ],
    "callbacks_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Callbacks" },
      { file: "activemodel.test.ts", describeBlock: "Callbacks (extended)" },
      { file: "activemodel.test.ts", describeBlock: "Callbacks (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Callbacks (advanced features)" },
      { file: "activemodel.test.ts", describeBlock: "callbacks with prepend option" },
      { file: "activemodel.test.ts", describeBlock: "CallbacksTest" },
    ],
    "naming_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Naming" },
      { file: "activemodel.test.ts", describeBlock: "Naming (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Naming (advanced)" },
      { file: "activemodel.test.ts", describeBlock: "humanAttributeName()" },
      { file: "activemodel.test.ts", describeBlock: "NamingWithSuppliedModelNameTest" },
      { file: "activemodel.test.ts", describeBlock: "NamingWithSuppliedLocaleTest" },
      { file: "activemodel.test.ts", describeBlock: "NamingUsingRelativeModelNameTest" },
      { file: "activemodel.test.ts", describeBlock: "NamingWithNamespacedModelInIsolatedNamespaceTest" },
      { file: "activemodel.test.ts", describeBlock: "OverridingAccessorsTest" },
      { file: "activemodel.test.ts", describeBlock: "NamingHelpersTest" },
      { file: "activemodel.test.ts", describeBlock: "NamingTest" },
      { file: "activemodel.test.ts", describeBlock: "NamingWithNamespacedModelInSharedNamespaceTest" },
    ],
    "serialization_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Serialization" },
      { file: "activemodel.test.ts", describeBlock: "Serialization (ported)" },
      { file: "activemodel.test.ts", describeBlock: "toXml()" },
      { file: "activemodel.test.ts", describeBlock: "fromJson" },
      { file: "activemodel.test.ts", describeBlock: "SerializationTest" },
    ],
    "attributes_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "Attributes (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Types" },
      { file: "activemodel.test.ts", describeBlock: "attributeBeforeTypeCast" },
      { file: "activemodel.test.ts", describeBlock: "attributesBeforeTypeCast" },
      { file: "activemodel.test.ts", describeBlock: "hasAttribute" },
      { file: "activemodel.test.ts", describeBlock: "attributeNames (instance)" },
      { file: "activemodel.test.ts", describeBlock: "AttributesTest" },
    ],
    "attribute_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "Attribute Object API" },
      { file: "activemodel.test.ts", describeBlock: "attributeBeforeTypeCast" },
      { file: "activemodel.test.ts", describeBlock: "Dirty Tracking" },
      { file: "activemodel.test.ts", describeBlock: "AttributeTest" },
    ],
    "attribute_registration_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "Attribute Registration" },
      { file: "activemodel.test.ts", describeBlock: "Types" },
      { file: "activemodel.test.ts", describeBlock: "TypeRegistry" },
      { file: "activemodel.test.ts", describeBlock: "typeForAttribute" },
      { file: "activemodel.test.ts", describeBlock: "AttributeRegistrationTest" },
    ],
    "attribute_assignment_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "Attribute Assignment (ported)" },
      { file: "activemodel.test.ts", describeBlock: "AttributeAssignmentTest" },
    ],
    "access_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "Access" },
    ],
    "model_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "Model (ported)" },
      { file: "activemodel.test.ts", describeBlock: "API tests" },
      { file: "activemodel.test.ts", describeBlock: "isPersisted" },
      { file: "activemodel.test.ts", describeBlock: "ModelTest" },
    ],
    "api_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "API tests" },
      { file: "activemodel.test.ts", describeBlock: "Model (ported)" },
      { file: "activemodel.test.ts", describeBlock: "isPersisted" },
      { file: "activemodel.test.ts", describeBlock: "APITest" },
    ],
    "conversion_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "toModel" },
      { file: "activemodel.test.ts", describeBlock: "Conversion (toKey/toParam)" },
      { file: "activemodel.test.ts", describeBlock: "Conversion (ported)" },
      { file: "activemodel.test.ts", describeBlock: "Naming" },
      { file: "activemodel.test.ts", describeBlock: "isPersisted" },
      { file: "activemodel.test.ts", describeBlock: "ConversionTest" },
    ],
    "attribute_methods_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "respondTo" },
      { file: "activemodel.test.ts", describeBlock: "Attribute Methods" },
      { file: "activemodel.test.ts", describeBlock: "attribute method prefix/suffix/affix" },
      { file: "activemodel.test.ts", describeBlock: "attributeMissing" },
      { file: "activemodel.test.ts", describeBlock: "AttributeMethodsTest" },
    ],
    "translation_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "humanAttributeName()" },
      { file: "activemodel.test.ts", describeBlock: "Naming" },
      { file: "activemodel.test.ts", describeBlock: "Translation (basic)" },
      { file: "activemodel.test.ts", describeBlock: "i18nScope" },
      { file: "activemodel.test.ts", describeBlock: "ActiveModelI18nTests" },
    ],
    "serializers/json_serialization_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "JSON Serialization (ported)" },
      { file: "activemodel.test.ts", describeBlock: "JSON Serialization (root in JSON)" },
      { file: "activemodel.test.ts", describeBlock: "Serialization (ported)" },
      { file: "activemodel.test.ts", describeBlock: "JsonSerializationTest" },
    ],
    "type/string_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
    ],
    "type/integer_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
    ],
    "type/boolean_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Attributes" },
      { file: "activemodel.test.ts", describeBlock: "Type Boolean (ported)" },
    ],
    "type/date_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "DateType" },
    ],
    "type/date_time_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "DateTimeType" },
    ],
    "type/decimal_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "DecimalType" },
      { file: "activemodel.test.ts", describeBlock: "Type Decimal (ported)" },
      { file: "activemodel.test.ts", describeBlock: "DecimalTest" },
    ],
    "type/registry_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "TypeRegistry" },
      { file: "activemodel.test.ts", describeBlock: "Type Registry (ported)" },
      { file: "activemodel.test.ts", describeBlock: "RegistryTest" },
    ],
    "type/big_integer_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
      { file: "activemodel.test.ts", describeBlock: "Type BigInteger" },
    ],
    "type/float_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
      { file: "activemodel.test.ts", describeBlock: "Type Float (ported)" },
      { file: "activemodel.test.ts", describeBlock: "FloatTest" },
    ],
    "type/time_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
    ],
    "type/value_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
      { file: "activemodel.test.ts", describeBlock: "Type Value" },
    ],
    "type/immutable_string_test.rb": [
      { file: "activemodel.test.ts", describeBlock: "Types" },
      { file: "activemodel.test.ts", describeBlock: "Type ImmutableString" },
    ],
  },

  // ==========================================================================
  // ActiveSupport
  // ==========================================================================
  activesupport: {
    "inflector_test.rb": [
      { file: "activesupport.test.ts", describeBlock: "Inflector" },
    ],
    "callbacks_test.rb": [
      { file: "callbacks.test.ts", describeBlock: "Callbacks" },
    ],
    "concern_test.rb": [
      { file: "concern.test.ts", describeBlock: "Concern" },
    ],
    "hash_with_indifferent_access_test.rb": [
      { file: "collections.test.ts", describeBlock: "HashWithIndifferentAccess" },
    ],
    "core_ext/string_ext_test.rb": [
      { file: "activesupport.test.ts", describeBlock: "String utilities" },
    ],
    "core_ext/enumerable_test.rb": [
      { file: "collections.test.ts", describeBlock: "deepMerge" },
      { file: "collections.test.ts", describeBlock: "slice" },
      { file: "collections.test.ts", describeBlock: "except" },
    ],
    "core_ext/hash_ext_test.rb": [
      { file: "collections.test.ts", describeBlock: "deepMerge" },
      { file: "collections.test.ts", describeBlock: "deepDup" },
      { file: "collections.test.ts", describeBlock: "deepTransformKeys" },
      { file: "collections.test.ts", describeBlock: "deepCamelizeKeys" },
      { file: "collections.test.ts", describeBlock: "deepUnderscoreKeys" },
    ],
    "class_attribute_test.rb": [
      { file: "class-attribute.test.ts", describeBlock: "classAttribute" },
    ],
  },

  // ==========================================================================
  // ActiveRecord
  // ==========================================================================
  activerecord: {
    "persistence_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "persistence" },
      { file: "activerecord.test.ts", describeBlock: "Persistence (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Base: increment/decrement/toggle" },
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "PersistenceTest" },
      { file: "rails-guided.test.ts", describeBlock: "Persistence (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Persistence edge cases (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "update_column / update_columns (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "base-extended.test.ts", describeBlock: "Persistence (extended)" },
    ],
    "finder_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "finders" },
      { file: "activerecord.test.ts", describeBlock: "Finders (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Base static query delegations" },
      { file: "activerecord.test.ts", describeBlock: "Static shorthands (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "FinderTest" },
      { file: "rails-guided.test.ts", describeBlock: "Finders (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Finders edge cases (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "relations.test.ts", describeBlock: "Finders" },
      { file: "base-extended.test.ts", describeBlock: "Finders (extended)" },
    ],
    "relations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "Relation (extended)" },
      { file: "activerecord.test.ts", describeBlock: "Relation edge cases" },
      { file: "coverage-boost.test.ts", describeBlock: "RelationTest" },
      { file: "activerecord.test.ts", describeBlock: "Relation: pick, first(n), last(n)" },
      { file: "activerecord.test.ts", describeBlock: "Relation: explain()" },
      { file: "activerecord.test.ts", describeBlock: "Relation: set operations" },
      { file: "activerecord.test.ts", describeBlock: "Relation: lock()" },
      { file: "activerecord.test.ts", describeBlock: "Relation state: isLoaded, reset, size, isEmpty, isAny, isMany" },
      { file: "activerecord.test.ts", describeBlock: "Relation#presence" },
      { file: "activerecord.test.ts", describeBlock: "Relation Where (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Relation State (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Relation Delete All / Update All (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Static shorthands (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Finders (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Base static query delegations" },
      { file: "rails-guided.test.ts", describeBlock: "Relation (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Relation query edge cases (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Rails-guided: New Features" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "relations.test.ts", describeBlock: "Relation" },
    ],
    "relation/where_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "where with Range" },
      { file: "activerecord.test.ts", describeBlock: "Relation Where (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "where with Range (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "WhereTest" },
      { file: "coverage-boost.test.ts", describeBlock: "WhereClauseTest" },
      { file: "relations.test.ts", describeBlock: "where" },
      { file: "relations.test.ts", describeBlock: "whereNot" },
      { file: "relations.test.ts", describeBlock: "whereAny" },
      { file: "relations.test.ts", describeBlock: "whereAll" },
      { file: "relations.test.ts", describeBlock: "where with Range" },
      { file: "relations.test.ts", describeBlock: "rewhere" },
      { file: "relations.test.ts", describeBlock: "invertWhere" },
    ],
    "relation/or_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation#or" },
      { file: "rails-guided.test.ts", describeBlock: "Relation#or (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "OrTest" },
      { file: "relations.test.ts", describeBlock: "or" },
    ],
    "relation/and_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "and()" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "AndTest" },
      { file: "relations.test.ts", describeBlock: "and" },
    ],
    "relation/delete_all_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "destroyBy and deleteBy" },
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "Relation Delete All / Update All (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "DeleteAllTest" },
    ],
    "relation/field_ordered_values_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "inOrderOf()" },
      { file: "coverage-boost.test.ts", describeBlock: "FieldOrderedValuesTest" },
      { file: "relations.test.ts", describeBlock: "inOrderOf" },
    ],
    "relation/order_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "regroup()" },
      { file: "coverage-boost.test.ts", describeBlock: "OrderTest" },
      { file: "relations.test.ts", describeBlock: "order" },
    ],
    "relation/select_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "select block form" },
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "coverage-boost.test.ts", describeBlock: "SelectTest" },
      { file: "relations.test.ts", describeBlock: "select" },
    ],
    "relation/structural_compatibility_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "structurallyCompatible" },
      { file: "coverage-boost.test.ts", describeBlock: "StructuralCompatibilityTest" },
      { file: "relations.test.ts", describeBlock: "structurallyCompatible" },
    ],
    "relation/update_all_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "static updateAll" },
      { file: "activerecord.test.ts", describeBlock: "Bulk operations edge cases" },
      { file: "activerecord.test.ts", describeBlock: "Relation Delete All / Update All (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "UpdateAllTest" },
    ],
    "relation/where_clause_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "where with Range" },
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "activerecord.test.ts", describeBlock: "Relation Where (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "WhereClauseTest" },
    ],
    "relation/with_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation" },
      { file: "coverage-boost.test.ts", describeBlock: "WithTest" },
    ],
    "calculations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Aggregations" },
      { file: "activerecord.test.ts", describeBlock: "Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "CalculationsTest" },
      { file: "activerecord.test.ts", describeBlock: "Base static query delegations" },
      { file: "activerecord.test.ts", describeBlock: "Static shorthands (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "distinct count" },
      { file: "activerecord.test.ts", describeBlock: "Aggregation edge cases" },
      { file: "activerecord.test.ts", describeBlock: "grouped calculations" },
      { file: "activerecord.test.ts", describeBlock: "Relation (extended)" },
      { file: "rails-guided.test.ts", describeBlock: "Calculations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Calculations edge cases (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "base-extended.test.ts", describeBlock: "Calculations (extended)" },
      { file: "relations.test.ts", describeBlock: "sum / average / minimum / maximum" },
      { file: "relations.test.ts", describeBlock: "count" },
      { file: "relations.test.ts", describeBlock: "pluck" },
      { file: "relations.test.ts", describeBlock: "pick" },
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
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "ScopingTest" },
      { file: "relations.test.ts", describeBlock: "defaultScope" },
      { file: "relations.test.ts", describeBlock: "unscoped" },
    ],
    "scoping/named_scoping_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Scopes" },
      { file: "activerecord.test.ts", describeBlock: "Scope proxy" },
      { file: "activerecord.test.ts", describeBlock: "scoping()" },
      { file: "rails-guided.test.ts", describeBlock: "Scopes (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Scopes edge cases (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "relations.test.ts", describeBlock: "scope" },
      { file: "relations.test.ts", describeBlock: "Scoping" },
    ],
    "scoping/relation_scoping_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "scoping()" },
      { file: "activerecord.test.ts", describeBlock: "Scopes" },
      { file: "activerecord.test.ts", describeBlock: "Scopes (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "relations.test.ts", describeBlock: "scoping block" },
    ],
    "associations/belongs_to_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "Associations: dependent" },
      { file: "activerecord.test.ts", describeBlock: "Callbacks (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "associations.test.ts", describeBlock: "BelongsToAssociations" },
      { file: "associations.test.ts", describeBlock: "DependentAssociations" },
      { file: "associations.test.ts", describeBlock: "StrictLoading" },
      { file: "associations.test.ts", describeBlock: "TouchBelongsToParents" },
    ],
    "associations/has_many_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "Associations: dependent" },
      { file: "activerecord.test.ts", describeBlock: "CollectionProxy" },
      { file: "activerecord.test.ts", describeBlock: "Callbacks (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "associations.test.ts", describeBlock: "HasManyAssociations" },
      { file: "associations.test.ts", describeBlock: "CollectionProxy" },
      { file: "associations.test.ts", describeBlock: "DependentAssociations" },
      { file: "associations.test.ts", describeBlock: "CounterCache" },
    ],
    "associations/has_one_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "Associations: dependent" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "associations.test.ts", describeBlock: "HasOneAssociations" },
      { file: "associations.test.ts", describeBlock: "DependentAssociations" },
      { file: "associations.test.ts", describeBlock: "StrictLoading" },
    ],
    "associations/has_many_through_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations: has_many through" },
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "association scopes" },
      { file: "activerecord.test.ts", describeBlock: "CollectionProxy" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "associations.test.ts", describeBlock: "HasManyThroughAssociations" },
    ],
    "associations/has_and_belongs_to_many_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "has_and_belongs_to_many" },
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "Associations: dependent" },
      { file: "rails-guided.test.ts", describeBlock: "HABTM (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "associations.test.ts", describeBlock: "HasAndBelongsToManyAssociations" },
    ],
    "associations/has_one_through_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "Associations: has_many through" },
      { file: "activerecord.test.ts", describeBlock: "Associations: dependent" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
    ],
    "associations/inner_join_association_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation: joins and leftJoins" },
    ],
    "associations/inverse_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "inverse_of" },
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "rails-guided.test.ts", describeBlock: "inverse_of (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "associations.test.ts", describeBlock: "AssociationReflection" },
    ],
    "associations/join_model_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "Relation: joins and leftJoins" },
      { file: "activerecord.test.ts", describeBlock: "Associations: dependent" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "associations.test.ts", describeBlock: "AssociationDefinitions" },
      { file: "associations.test.ts", describeBlock: "AssociationReflection" },
    ],
    "associations/left_outer_join_association_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Relation: joins and leftJoins" },
    ],
    "associations/nested_through_associations_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations: has_many through" },
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "has_and_belongs_to_many" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
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
      { file: "activerecord.test.ts", describeBlock: "Finders (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Rails-guided: New Features" },
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
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Associations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Rails-guided: New Features" },
      { file: "associations.test.ts", describeBlock: "AssociationDefinitions" },
      { file: "associations.test.ts", describeBlock: "AssociationReflection" },
      { file: "associations.test.ts", describeBlock: "CollectionProxy" },
    ],
    "transactions_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Transactions" },
      { file: "rails-guided.test.ts", describeBlock: "Transactions (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "TransactionTest" },
    ],
    "transaction_callbacks_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "afterCommit / afterRollback" },
      { file: "activerecord.test.ts", describeBlock: "Callbacks (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Callbacks (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
    ],
    "callbacks_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "callbacks" },
      { file: "activerecord.test.ts", describeBlock: "Callbacks (extended)" },
      { file: "rails-guided.test.ts", describeBlock: "Callbacks (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Conditional Callbacks (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "CallbacksTest" },
    ],
    "timestamp_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Timestamps" },
      { file: "rails-guided.test.ts", describeBlock: "Timestamps (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
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
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "EachTest" },
    ],
    "enum_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Enum" },
      { file: "coverage-boost.test.ts", describeBlock: "EnumTest" },
      { file: "rails-guided.test.ts", describeBlock: "Enum (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "base-extended.test.ts", describeBlock: "Enum (extended)" },
    ],
    "inheritance_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "STI" },
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "STI (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
    ],
    "inherited_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "STI" },
    ],
    "locking_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "optimistic locking" },
      { file: "rails-guided.test.ts", describeBlock: "Optimistic Locking (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
    ],
    "custom_locking_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "optimistic locking" },
    ],
    "readonly_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "readonly" },
      { file: "rails-guided.test.ts", describeBlock: "Readonly (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
    ],
    "store_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Store" },
      { file: "rails-guided.test.ts", describeBlock: "Store (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
    ],
    "secure_password_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "secure_password" },
      { file: "rails-guided.test.ts", describeBlock: "SecurePassword (Rails-guided)" },
    ],
    "counter_cache_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "counter_cache" },
      { file: "rails-guided.test.ts", describeBlock: "Counter Cache (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "associations.test.ts", describeBlock: "CounterCache" },
    ],
    "migration_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Migrations" },
      { file: "activerecord.test.ts", describeBlock: "Migration DDL (extended)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Rails-guided: New Features" },
    ],
    "insert_all_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "insertAll / upsertAll" },
      { file: "rails-guided.test.ts", describeBlock: "insertAll / upsertAll (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
    ],
    "reflection_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "reflection" },
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Reflection (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "associations.test.ts", describeBlock: "AssociationReflection" },
    ],
    "nested_attributes_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "acceptsNestedAttributesFor" },
      { file: "activerecord.test.ts", describeBlock: "Callbacks (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Nested Attributes (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
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
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
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
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Rails-guided: New Features" },
    ],
    "attribute_methods_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "hasAttribute()" },
      { file: "activerecord.test.ts", describeBlock: "attributeNames()" },
      { file: "activerecord.test.ts", describeBlock: "humanAttributeName" },
      { file: "activerecord.test.ts", describeBlock: "attributePresent()" },
      { file: "activerecord.test.ts", describeBlock: "attributesBeforeTypeCast on Base" },
      { file: "activerecord.test.ts", describeBlock: "columnForAttribute on Base" },
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Rails-guided: New Features" },
      { file: "coverage-boost.test.ts", describeBlock: "AttributeMethodsTest" },
      { file: "base-extended.test.ts", describeBlock: "Attributes (extended)" },
    ],
    "cache_key_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "cacheKey / cacheKeyWithVersion" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "CacheKeyTest" },
    ],
    "excluding_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "excluding() / without()" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "ExcludingTest" },
    ],
    "errors_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "error classes" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
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
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Base: increment/decrement/toggle" },
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
      { file: "activerecord.test.ts", describeBlock: "Persistence (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Rails-guided: New Features" },
      { file: "coverage-boost.test.ts", describeBlock: "BasicsTest" },
      { file: "base-extended.test.ts", describeBlock: "Base (extended)" },
    ],
    "autosave_association_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "Associations" },
      { file: "activerecord.test.ts", describeBlock: "isChangedForAutosave" },
      { file: "activerecord.test.ts", describeBlock: "acceptsNestedAttributesFor" },
      { file: "activerecord.test.ts", describeBlock: "Callbacks (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
    ],
    "dirty_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "dirty tracking: attributeInDatabase, attributeBeforeLastSave" },
      { file: "activerecord.test.ts", describeBlock: "savedChanges" },
      { file: "activerecord.test.ts", describeBlock: "previouslyNewRecord" },
      { file: "activerecord.test.ts", describeBlock: "attributeChanged with from/to options" },
      { file: "activerecord.test.ts", describeBlock: "Dirty (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "coverage-boost.test.ts", describeBlock: "DirtyTest" },
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
      { file: "activerecord.test.ts", describeBlock: "Relation Where (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Relation State (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Relation Delete All / Update All (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Relation (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Relation query edge cases (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
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
      { file: "activerecord.test.ts", describeBlock: "Relation (extended)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
      { file: "relations.test.ts", describeBlock: "merge" },
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
      { file: "associations.test.ts", describeBlock: "StrictLoading" },
    ],
    "primary_keys_test.rb": [
      { file: "activerecord.test.ts", describeBlock: "primary key" },
      { file: "activerecord.test.ts", describeBlock: "Base" },
      { file: "activerecord.test.ts", describeBlock: "Base features (Rails-guided)" },
      { file: "activerecord.test.ts", describeBlock: "Finders (Rails-guided)" },
      { file: "rails-guided.test.ts", describeBlock: "Grouped Calculations (Rails-guided)" },
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
      { file: "coverage-boost.test.ts", describeBlock: "NullRelationTest" },
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
      { file: "coverage-boost.test.ts", describeBlock: "SanitizeTest" },
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
    // Strip Ruby test class prefixes like "TestAscending > ", "FilterTest > ",
    // "Arel::Nodes::OverTest > ", "NodesTest > ", "SqlLiteralTest > ", etc.
    .replace(/^(?:Arel::Nodes::|Arel::)?(?:Test)?[A-Z][A-Za-z]*(?:Test)?\s*>\s*/, "")
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
    // Normalize "ascending?" to "ascending", "descending?" to "descending"
    .replace(/\?/g, "")
    // Normalize "eql?" references
    .replace(/\beql returns true\b/g, "eql")
    // Remove parenthetical clarifications like "(checks left/right)", "(same table and column)", "(immutability)"
    .replace(/\([^)]*\)/g, "")
    // Normalize "via sql" / "in sql" / "via constructor"
    .replace(/\bvia\b/g, "")
    .replace(/\bin\b/g, "")
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
    // Only if the shorter is at least 40% of the longer
    const shorter = rubyNorm.length < tsNorm.length ? rubyNorm : tsNorm;
    const longer = rubyNorm.length >= tsNorm.length ? rubyNorm : tsNorm;
    if (shorter.length / longer.length >= 0.4) {
      return "fuzzy";
    }
  }

  // Word overlap — check if domain-specific words match (exclude stopwords)
  const STOPWORDS = new Set([
    "the", "and", "for", "with", "from", "that", "this", "not", "but",
    "all", "are", "can", "one", "new", "its", "when", "record", "value",
    "attribute", "given", "only", "also", "into", "will", "nil", "null",
    "an", "a", "be", "have", "do",
  ]);
  const domainWords = (s: string) =>
    new Set(s.split(" ").filter(w => w.length > 2 && !STOPWORDS.has(w)));
  const rubyWords = domainWords(rubyNorm);
  const tsWords = domainWords(tsNorm);
  if (rubyWords.size >= 1 && tsWords.size >= 1) {
    let matches = 0;
    for (const word of rubyWords) {
      if (tsWords.has(word)) matches++;
    }
    const overlapRatio = matches / Math.max(rubyWords.size, tsWords.size);
    if (overlapRatio >= 0.5 && matches >= 2) return "fuzzy";
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
  // ==========================================================================
  // Arel overrides
  // ==========================================================================
  // Ruby-only features we skip
  "SqlLiteralTest > serializes into YAML": null,
  "SqlLiteralTest > generates a Fragments node": null,
  "can define a dispatch method": null,
  "should visit_Set": null,
  // Duplicate test name - map to existing test
  "AttributeTest > can be constructed with an exclusive range":
    "Arel > Attribute between (range variants) > can be constructed with an exclusive range",

  // ==========================================================================
  // ActiveModel overrides
  // ==========================================================================
  "AccessTest > slice": "ActiveModel > Access > slice",
  "AccessTest > slice with array": "ActiveModel > Access > slice with array",
  "AccessTest > values_at": "ActiveModel > Access > values_at",
  "AccessTest > values_at with array": "ActiveModel > Access > values_at with array",
  "APITest > initialize with params": "ActiveModel > Model (ported) > initialize with params",
  "APITest > initialize with nil or empty hash params does not explode": "ActiveModel > Model (ported) > initialize with nil or empty hash params does not explode",
  "APITest > mixin inclusion chain": "ActiveModel > API tests > mixin inclusion chain",
  "AttributeAssignmentTest > simple assignment": "ActiveModel > Attribute Assignment (ported) > simple assignment",
  "AttributeAssignmentTest > regular hash should still be used for mass assignment": "ActiveModel > Attribute Assignment (ported) > regular hash should still be used for mass assignment",
  "AttributeMethodsTest > method missing works correctly even if attributes method is not defined": "ActiveModel > Attribute Methods > method missing works correctly even if attributes method is not defined",
  "AttributeMethodsTest > unrelated classes should not share attribute method matchers": "ActiveModel > Attribute Methods > unrelated classes should not share attribute method matchers",
  "AttributeMethodsTest > #define_attribute_method generates attribute method": "ActiveModel > Attribute Methods > #define_attribute_method generates attribute method",
  "AttributeMethodsTest > #define_attribute_methods defines alias attribute methods after undefining": "ActiveModel > Attribute Methods > #define_attribute_methods defines alias attribute methods after undefining",
  "AttributeMethodsTest > #undefine_attribute_methods removes attribute methods": "ActiveModel > Attribute Methods > #undefine_attribute_methods removes attribute methods",
  "AttributeMethodsTest > accessing a suffixed attribute": "ActiveModel > Attribute Methods > accessing a suffixed attribute",
  "AttributeMethodsTest > should not interfere with method_missing if the attr has a private/protected method": "ActiveModel > Attribute Methods > should not interfere with method_missing if the attr has a private/protected method",
  "AttributeMethodsTest > should use attribute_missing to dispatch a missing attribute": "ActiveModel > Attribute Methods > should use attribute_missing to dispatch a missing attribute",
  "AttributeMethodsTest > name clashes are handled": "ActiveModel > Attribute Methods > name clashes are handled",
  "AttributeRegistrationTest > the default type is used when type is omitted": "ActiveModel > Attribute Registration > the default type is used when type is omitted",
  "AttributeRegistrationTest > type is resolved when specified by name": "ActiveModel > Attribute Registration > type is resolved when specified by name",
  "AttributeRegistrationTest > .attribute_types reflects registered attribute types": "ActiveModel > Attribute Registration > .attribute_types reflects registered attribute types",
  "AttributeRegistrationTest > .decorate_attributes decorates specified attributes": "ActiveModel > Attribute Registration > .decorate_attributes decorates specified attributes",
  "AttributeRegistrationTest > .decorate_attributes stacks decorators": "ActiveModel > Attribute Registration > .decorate_attributes stacks decorators",
  "AttributeRegistrationTest > re-registering an attribute overrides previous decorators": "ActiveModel > Attribute Registration > re-registering an attribute overrides previous decorators",
  "AttributeTest > from_database + read type casts from database": "ActiveModel > Attribute Object API > from_database + read type casts from database",
  "AttributeTest > from_user + read type casts from user": "ActiveModel > Attribute Object API > from_user + read type casts from user",
  "AttributeTest > reading memoizes the value": "ActiveModel > Attribute Object API > reading memoizes the value",
  "AttributeTest > reading memoizes falsy values": "ActiveModel > Attribute Object API > reading memoizes falsy values",
  "AttributeTest > from_database + value_for_database type casts to and from database": "ActiveModel > Attribute Object API > from_database + value_for_database type casts to and from database",
  "AttributeTest > duping dups the value": "ActiveModel > Attribute Object API > duping dups the value",
  "AttributeTest > with_value_from_user returns a new attribute with the value from the user": "ActiveModel > Attribute Object API > with_value_from_user returns a new attribute with the value from the user",
  "AttributeTest > with_value_from_database returns a new attribute with the value from the database": "ActiveModel > Attribute Object API > with_value_from_database returns a new attribute with the value from the database",
  "AttributeTest > uninitialized attributes have no value": "ActiveModel > Attribute Object API > uninitialized attributes have no value",
  "AttributeTest > attributes equal other attributes with the same constructor arguments": "ActiveModel > Attribute Object API > attributes equal other attributes with the same constructor arguments",
  "AttributeTest > an attribute has not been read by default": "ActiveModel > Attribute Object API > an attribute has not been read by default",
  "AttributeTest > with_type preserves mutations": "ActiveModel > Attribute Object API > with_type preserves mutations",
  "AttributesDirtyTest > checking if an attribute has changed to a particular value": "ActiveModel > Dirty (ported) > checking if an attribute has changed to a particular value",
  "AttributesDirtyTest > attribute mutation": "ActiveModel > Dirty (advanced) > attribute mutation",
  "AttributesDirtyTest > saving should reset model's changed status": "ActiveModel > Dirty (ported) > saving should reset model's changed status",
  "AttributesDirtyTest > saving should preserve model's previous changed status": "ActiveModel > Dirty (ported) > saving should preserve model's previous changed status",
  "AttributesDirtyTest > previous value is preserved when changed after save": "ActiveModel > Dirty (ported) > previous value is preserved when changed after save",
  "AttributesDirtyTest > using attribute_will_change! with a symbol": "ActiveModel > Dirty (advanced) > using attribute_will_change! with a symbol",
  "AttributesTest > properties assignment": "ActiveModel > Attributes (ported) > properties assignment",
  "AttributesTest > reading attributes": "ActiveModel > Attributes (ported) > reading attributes",
  "AttributesTest > reading attribute names": "ActiveModel > Attributes (ported) > reading attribute names",
  "AttributesTest > children can override parents": "ActiveModel > Attributes (ported) > children can override parents",
  "AttributesTest > attributes can be dup-ed": "ActiveModel > Attributes (ported) > attributes can be dup-ed",
  "BooleanTest > type cast boolean": "ActiveModel > Type Boolean (ported) > type cast boolean",
  "BigIntegerTest > type cast big integer": "ActiveModel > Type BigInteger > type cast big integer",
  "BigIntegerTest > BigInteger small values": "ActiveModel > Type BigInteger > BigInteger small values",
  "CallbacksTest > the callback chain is not halted when around or after callbacks return false": "ActiveModel > Callbacks (advanced features) > the callback chain is not halted when around or after callbacks return false",
  "CallbacksTest > the callback chain is halted when a callback throws :abort": "ActiveModel > Callbacks (ported) > the callback chain is halted when a callback throws :abort",
  "CallbacksTest > only selects which types of callbacks should be created": "ActiveModel > Callbacks (ported) > only selects which types of callbacks should be created",
  "CallbacksTest > the :if option array should not be mutated by an after callback": "ActiveModel > Callbacks (advanced features) > the :if option array should not be mutated by an after callback",
  "CallbacksTest > after_create callbacks with both callbacks declared in one line": "ActiveModel > Callbacks (ported) > after_create callbacks with both callbacks declared in one line",
  "CallbacksWithMethodNamesShouldBeCalled > before validation and after validation callbacks should be called in declared order": "ActiveModel > Validations Callbacks (ported) > before validation and after validation callbacks should be called in declared order",
  "CallbacksWithMethodNamesShouldBeCalled > further callbacks should not be called if before validation throws abort": "ActiveModel > Validations Callbacks (ported) > further callbacks should not be called if before validation throws abort",
  "CallbacksWithMethodNamesShouldBeCalled > if condition is respected for before validation": "ActiveModel > Callbacks (advanced features) > if condition is respected for before validation",
  "CallbacksWithMethodNamesShouldBeCalled > on condition is respected for validation with matching context": "ActiveModel > Callbacks (advanced features) > on condition is respected for validation with matching context",
  "CallbacksWithMethodNamesShouldBeCalled > validation test should be done": "ActiveModel > Validations Callbacks (ported) > validation test should be done",
  "ComparisonValidationTest > validates comparison of multiple values": "ActiveModel > Validations Comparison (ported) > validates comparison of multiple values",
  "ComparisonValidationTest > validates comparison with equal to using numeric": "ActiveModel > Validations Comparison (ported) > validates comparison with equal to using numeric",
  "ComparisonValidationTest > validates comparison with greater than or equal to using numeric": "ActiveModel > Validations Comparison (ported) > validates comparison with greater than or equal to using numeric",
  "ComparisonValidationTest > validates comparison with less than or equal to using numeric": "ActiveModel > Validations Comparison (ported) > validates comparison with less than or equal to using numeric",
  "ComparisonValidationTest > validates comparison with nil allowed": "ActiveModel > Validations Comparison (ported) > validates comparison with nil allowed",
  "ComparisonValidationTest > validates comparison with other than using numeric": "ActiveModel > Validations Comparison (ported) > validates comparison with other than using numeric",
  "ComparisonValidationTest > validates comparison with proc": "ActiveModel > Validations Comparison (ported) > validates comparison with proc",
  "ConditionalValidationTest > if validation using block false": "ActiveModel > Validations Conditional (ported) > if validation using block false",
  "ConditionalValidationTest > if validation using block true": "ActiveModel > Validations Conditional (ported) > if validation using block true",
  "ConditionalValidationTest > unless validation using block false": "ActiveModel > Validations Conditional (ported) > unless validation using block false",
  "ConditionalValidationTest > unless validation using block true": "ActiveModel > Validations Conditional (ported) > unless validation using block true",
  "ConditionalValidationTest > validation using combining if true and unless false conditions": "ActiveModel > Validations Conditional (ported) > validation using combining if true and unless false conditions",
  "ConditionalValidationTest > validation using combining if true and unless true conditions": "ActiveModel > Validations Conditional (ported) > validation using combining if true and unless true conditions",
  "ConfirmationValidationTest > title confirmation": "ActiveModel > Validations Confirmation (ported) > title confirmation",
  "ConfirmationValidationTest > no title confirmation": "ActiveModel > Validations Confirmation (ported) > no title confirmation",
  "ConfirmationValidationTest > title confirmation with case sensitive option true": "ActiveModel > Validations Confirmation (ported) > title confirmation with case sensitive option true",
  "ConfirmationValidationTest > title confirmation with case sensitive option false": "ActiveModel > Validations Confirmation (ported) > title confirmation with case sensitive option false",
  "ConversionTest > to_key default implementation returns nil for new records": "ActiveModel > Conversion (ported) > to_key default implementation returns nil for new records",
  "ConversionTest > to_key default implementation returns the id in an array for persisted records": "ActiveModel > Conversion (toKey/toParam) > to_key default implementation returns the id in an array for persisted records",
  "ConversionTest > to_param default implementation returns a string of ids for persisted records": "ActiveModel > Conversion (toKey/toParam) > to_param default implementation returns a string of ids for persisted records",
  "ConversionTest > to_param default implementation returns nil for new records": "ActiveModel > Conversion (ported) > to_param default implementation returns nil for new records",
  "ConversionTest > to_param returns the string joined by '-'": "ActiveModel > Conversion (toKey/toParam) > to_param returns the string joined by '-'",
  "ConversionTest > to_partial_path default implementation returns a string giving a relative path": "ActiveModel > Conversion (ported) > to_partial_path default implementation returns a string giving a relative path",
  "DecimalTest > type cast decimal": "ActiveModel > Type Decimal (ported) > type cast decimal",
  "DecimalTest > type cast decimal from invalid string": "ActiveModel > Type Decimal (ported) > type cast decimal from invalid string",
  "DirtyTest > setting attribute will result in change": "ActiveModel > Dirty (ported) > setting attribute will result in change",
  "DirtyTest > list of changed attribute keys": "ActiveModel > Dirty (ported) > list of changed attribute keys",
  "DirtyTest > changes to attribute values": "ActiveModel > Dirty (ported) > changes to attribute values",
  "DirtyTest > changing the same attribute multiple times retains the correct original value": "ActiveModel > Dirty (ported) > changing the same attribute multiple times retains the correct original value",
  "DirtyTest > checking if an attribute was previously changed to a particular value": "ActiveModel > Dirty (ported) > checking if an attribute was previously changed to a particular value",
  "DirtyTest > clear_changes_information should reset all changes": "ActiveModel > Dirty (ported) > clear_changes_information should reset all changes",
  "DirtyTest > model can be dup-ed without Attributes": "ActiveModel > Dirty (advanced) > model can be dup-ed without Attributes",
  "DirtyTest > resetting attribute": "ActiveModel > Dirty (ported) > resetting attribute",
  "DirtyTest > restore_attributes should restore all previous data": "ActiveModel > Dirty (ported) > restore_attributes should restore all previous data",
  "DirtyTest > saving should preserve previous changes": "ActiveModel > Dirty (ported) > saving should preserve previous changes",
  "DirtyTest > saving should preserve model's previous changed status": "ActiveModel > Dirty (ported) > saving should preserve model's previous changed status",
  "DirtyTest > saving should reset model's changed status": "ActiveModel > Dirty (ported) > saving should reset model's changed status",
  "DirtyTest > setting color to same value should not result in change being recorded": "ActiveModel > Dirty (ported) > setting color to same value should not result in change being recorded",
  "DirtyTest > setting new attributes should not affect previous changes": "ActiveModel > Dirty (ported) > setting new attributes should not affect previous changes",
  "DirtyTest > previous value is preserved when changed after save": "ActiveModel > Dirty (ported) > previous value is preserved when changed after save",
  "DirtyTest > attribute mutation": "ActiveModel > Dirty (advanced) > attribute mutation",
  "DirtyTest > using attribute_will_change! with a symbol": "ActiveModel > Dirty (advanced) > using attribute_will_change! with a symbol",
  "DirtyTest > to_json should work on model": "ActiveModel > Dirty JSON tests > to_json should work on model",
  "DirtyTest > to_json should work on model after save": "ActiveModel > Dirty JSON tests > to_json should work on model after save",
  "DirtyTest > to_json should work on model with :except array option": "ActiveModel > Dirty JSON tests > to_json should work on model with :except array option",
  "DirtyTest > to_json should work on model with :except string option": "ActiveModel > Dirty JSON tests > to_json should work on model with :except string option",
  "ErrorTest > initialize": "ActiveModel > Error (ported) > initialize",
  "ErrorTest > initialize without type": "ActiveModel > Error (ported) > initialize without type",
  "ErrorTest > match? handles attribute match": "ActiveModel > Error (ported) > match? handles attribute match",
  "ErrorTest > match? handles error type match": "ActiveModel > Error (ported) > match? handles error type match",
  "ErrorTest > message with type as custom message": "ActiveModel > Error (ported) > message with type as custom message",
  "ErrorTest > message with options[:message] as custom message": "ActiveModel > Error (ported) > message with options[:message] as custom message",
  "ErrorTest > message renders lazily using current locale": "ActiveModel > Errors (advanced features) > message renders lazily using current locale",
  "ErrorTest > message uses current locale": "ActiveModel > Errors (advanced features) > message uses current locale",
  "ErrorTest > equality by base attribute, type and options": "ActiveModel > Error (ported) > equality by base attribute, type and options",
  "ErrorTest > inequality": "ActiveModel > Error (ported) > inequality",
  "ErrorTest > full_message returns the given message when the attribute contains base": "ActiveModel > Error (ported) > full_message returns the given message when the attribute contains base",
  "ErrorTest > details which ignores callback and message options": "ActiveModel > Error (ported) > details which ignores callback and message options",
  "ErrorsTest > delete": "ActiveModel > Errors (ported) > delete",
  "ErrorsTest > each when arity is negative": "ActiveModel > Errors (ported) > each when arity is negative",
  "ErrorsTest > any?": "ActiveModel > Errors (ported) > any?",
  "ErrorsTest > has key?": "ActiveModel > Errors (ported) > has key?",
  "ErrorsTest > has no key": "ActiveModel > Errors (ported) > has no key",
  "ErrorsTest > attribute_names returns an empty array after try to get a message only": "ActiveModel > Errors (ported) > attribute_names returns an empty array after try to get a message only",
  "ErrorsTest > include? does not add a key to messages hash": "ActiveModel > Errors (ported) > include? does not add a key to messages hash",
  "ErrorsTest > add, with type as String": "ActiveModel > Errors (ported) > add, with type as String",
  "ErrorsTest > added? detects indifferent if a specific error was added to the object": "ActiveModel > Errors (ported) > added? detects indifferent if a specific error was added to the object",
  "ErrorsTest > added? handles proc messages": "ActiveModel > Errors (advanced features) > added? handles proc messages",
  "ErrorsTest > added? ignores callback option": "ActiveModel > Errors (advanced features) > added? ignores callback option",
  "ErrorsTest > added? matches the given message when several errors are present for the same attribute": "ActiveModel > Errors (ported) > added? matches the given message when several errors are present for the same attribute",
  "ErrorsTest > added? returns false when checking a nonexisting error and other errors are present for the given attribute": "ActiveModel > Errors (ported) > added? returns false when checking a nonexisting error and other errors are present for the given attribute",
  "ErrorsTest > added? returns false when no errors are present": "ActiveModel > Errors (ported) > added? returns false when no errors are present",
  "ErrorsTest > as_json creates a json formatted representation of the errors hash": "ActiveModel > Errors (ported) > as_json creates a json formatted representation of the errors hash",
  "ErrorsTest > clear removes details": "ActiveModel > Errors (ported) > clear removes details",
  "ErrorsTest > copy errors": "ActiveModel > Errors (ported) > copy errors",
  "ErrorsTest > count calculates the number of error messages": "ActiveModel > Errors (ported) > count calculates the number of error messages",
  "ErrorsTest > delete returns nil when no errors were deleted": "ActiveModel > Errors (ported) > delete returns nil when no errors were deleted",
  "ErrorsTest > details do not include message option": "ActiveModel > Errors (ported) > details do not include message option",
  "ErrorsTest > details retains original type as error": "ActiveModel > Errors (ported) > details retains original type as error",
  "ErrorsTest > details returns added error detail with custom option": "ActiveModel > Errors (ported) > details returns added error detail with custom option",
  "ErrorsTest > dup duplicates details": "ActiveModel > Errors (advanced features) > dup duplicates details",
  "ErrorsTest > errors are marshalable": "ActiveModel > Errors (advanced features) > errors are marshalable",
  "ErrorsTest > full_message returns the given message when attribute is :base": "ActiveModel > Errors (ported) > full_message returns the given message when attribute is :base",
  "ErrorsTest > full_message returns the given message with the attribute name included": "ActiveModel > Errors (ported) > full_message returns the given message with the attribute name included",
  "ErrorsTest > full_messages doesn't require the base object to respond to `:errors": "ActiveModel > Errors (advanced features) > full_messages doesn't require the base object to respond to :errors",
  "ErrorsTest > full_messages_for contains all the error messages for the given attribute indifferent": "ActiveModel > Errors (ported) > full_messages_for contains all the error messages for the given attribute indifferent",
  "ErrorsTest > full_messages_for does not contain error messages from other attributes": "ActiveModel > Errors (ported) > full_messages_for does not contain error messages from other attributes",
  "ErrorsTest > full_messages_for returns an empty list in case there are no errors for the given attribute": "ActiveModel > Errors (ported) > full_messages_for returns an empty list in case there are no errors for the given attribute",
  "ErrorsTest > generate_message works without i18n_scope": "ActiveModel > Errors (ported) > generate_message works without i18n_scope",
  "ErrorsTest > group_by_attribute": "ActiveModel > Errors (ported) > group_by_attribute",
  "ErrorsTest > inspect": "ActiveModel > Errors (advanced features) > inspect",
  "ErrorsTest > merge does not import errors when merging with self": "ActiveModel > Errors (advanced features) > merge does not import errors when merging with self",
  "ErrorsTest > messages returns empty frozen array when accessed with non-existent attribute": "ActiveModel > Errors (ported) > messages returns empty frozen array when accessed with non-existent attribute",
  "ErrorsTest > of_kind? defaults message to :invalid": "ActiveModel > Errors (ported) > of_kind? defaults message to :invalid",
  "ErrorsTest > of_kind? detects indifferent if a specific error was added to the object": "ActiveModel > Errors (ported) > of_kind? detects indifferent if a specific error was added to the object",
  "ErrorsTest > of_kind? handles proc messages": "ActiveModel > Errors (advanced features) > of_kind? handles proc messages",
  "ErrorsTest > of_kind? ignores options": "ActiveModel > Errors (advanced features) > of_kind? ignores options",
  "ErrorsTest > of_kind? matches the given message when several errors are present for the same attribute": "ActiveModel > Errors (ported) > of_kind? matches the given message when several errors are present for the same attribute",
  "ErrorsTest > of_kind? returns false when checking a nonexisting error and other errors are present for the given attribute": "ActiveModel > Errors (ported) > of_kind? returns false when checking a nonexisting error and other errors are present for the given attribute",
  "ErrorsTest > of_kind? returns false when checking for an error by symbol and a different error with same message is present": "ActiveModel > Errors (ported) > of_kind? returns false when checking for an error by symbol and a different error with same message is present",
  "ErrorsTest > of_kind? returns false when no errors are present": "ActiveModel > Errors (ported) > of_kind? returns false when no errors are present",
  "ErrorsTest > to_a returns the list of errors with complete messages containing the attribute names": "ActiveModel > Errors (ported) > to_a returns the list of errors with complete messages containing the attribute names",
  "ExclusionValidationTest > validates exclusion of with formatted message": "ActiveModel > Validations Exclusion (ported) > validates exclusion of with formatted message",
  "ExclusionValidationTest > validates exclusion of with lambda": "ActiveModel > Validations (advanced features) > validates exclusion of with lambda",
  "FloatTest > type cast float from invalid string": "ActiveModel > Type Float (ported) > type cast float from invalid string",
  "FormatValidationTest > validate format of with multiline regexp should raise error": "ActiveModel > Validations (advanced features) > validates format of with multiline regexp should raise error",
  "FormatValidationTest > validate format of without any regexp should raise error": "ActiveModel > Validations (advanced features) > validates format of without any regexp should raise error",
  "FormatValidationTest > validate format with formatted message": "ActiveModel > Validations Format (ported) > validate format with formatted message",
  "FormatValidationTest > validate format with not option": "ActiveModel > Validations Format (ported) > validate format with not option",
  "ImmutableStringTest > cast strings are frozen": "ActiveModel > Type ImmutableString > cast strings are frozen",
  "ImmutableStringTest > immutable strings are not duped coming out": "ActiveModel > Type ImmutableString > immutable strings are not duped coming out",
  "InclusionValidationTest > validates inclusion of": "ActiveModel > Validations Inclusion (ported) > validates inclusion of",
  "InclusionValidationTest > validates inclusion of with allow nil": "ActiveModel > Validations Inclusion (ported) > validates inclusion of with allow nil",
  "InclusionValidationTest > validates inclusion of with formatted message": "ActiveModel > Validations Inclusion (ported) > validates inclusion of with formatted message",
  "InclusionValidationTest > validates inclusion of with lambda": "ActiveModel > Validations (advanced features) > validates inclusion of with lambda",
  "JsonSerializationTest > as_json should allow attribute filtering with except": "ActiveModel > JSON Serialization (ported) > as_json should allow attribute filtering with except",
  "JsonSerializationTest > as_json should allow attribute filtering with only": "ActiveModel > JSON Serialization (ported) > as_json should allow attribute filtering with only",
  "JsonSerializationTest > as_json should return a hash if include_root_in_json is true": "ActiveModel > JSON Serialization (root in JSON) > as_json should return a hash if include_root_in_json is true",
  "JsonSerializationTest > from_json should work with a root (method parameter)": "ActiveModel > JSON Serialization (ported) > from_json should work with a root (method parameter)",
  "JsonSerializationTest > from_json should work without a root (class attribute)": "ActiveModel > JSON Serialization (ported) > from_json should work without a root (class attribute)",
  "JsonSerializationTest > serializable_hash should not modify options passed in argument": "ActiveModel > Serialization (ported) > serializable_hash should not modify options passed in argument",
  "JsonSerializationTest > should allow attribute filtering with except": "ActiveModel > JSON Serialization (ported) > should allow attribute filtering with except",
  "JsonSerializationTest > should allow attribute filtering with only": "ActiveModel > JSON Serialization (ported) > should allow attribute filtering with only",
  "JsonSerializationTest > should encode all encodable attributes": "ActiveModel > JSON Serialization (ported) > should encode all encodable attributes",
  "JsonSerializationTest > should include root in JSON if include_root_in_json is true": "ActiveModel > JSON Serialization (root in JSON) > should include root in JSON if include_root_in_json is true",
  "LengthValidationTest > validates length of custom errors for both too short and too long": "ActiveModel > Validations Length (ported) > validates length of custom errors for both too short and too long",
  "LengthValidationTest > validates length of custom errors for is with wrong length": "ActiveModel > Validations Length (ported) > validates length of custom errors for is with wrong length",
  "LengthValidationTest > validates length of custom errors for maximum with too long": "ActiveModel > Validations Length (ported) > validates length of custom errors for maximum with too long",
  "LengthValidationTest > validates length of custom errors for minimum with too short": "ActiveModel > Validations Length (ported) > validates length of custom errors for minimum with too short",
  "LengthValidationTest > validates length of using is": "ActiveModel > Validations Length (ported) > validates length of using is",
  "LengthValidationTest > validates length of using maximum": "ActiveModel > Validations Length (ported) > validates length of using maximum",
  "LengthValidationTest > validates length of using maximum should allow nil": "ActiveModel > Validations Length (ported) > validates length of using maximum should allow nil",
  "LengthValidationTest > validates length of using proc as maximum": "ActiveModel > Validations (advanced features) > validates length of using proc as maximum",
  "LengthValidationTest > validates length of using within": "ActiveModel > Validations Length (ported) > validates length of using within",
  "ModelTest > load hook is called": "ActiveModel > API tests > load hook is called",
  "ModelTest > persisted is always false": "ActiveModel > Model (ported) > persisted is always false",
  "NameWithAnonymousClassTest > anonymous class without name argument": "ActiveModel > Naming (advanced) > anonymous class without name argument",
  "NamingHelpersTest > to model called on record": "ActiveModel > Naming (ported) > to model called on record",
  "NamingMethodDelegationTest > model name": "ActiveModel > Naming (ported) > model name",
  "NamingWithNamespacedModelInIsolatedNamespaceTest > collection": "ActiveModel > Naming (ported) > collection",
  "NamingWithNamespacedModelInIsolatedNamespaceTest > element": "ActiveModel > Naming (ported) > element",
  "NamingWithNamespacedModelInIsolatedNamespaceTest > i18n key": "ActiveModel > Naming (ported) > i18n key",
  "NamingWithNamespacedModelInIsolatedNamespaceTest > param key": "ActiveModel > Naming (ported) > param key",
  "NamingWithNamespacedModelInIsolatedNamespaceTest > plural": "ActiveModel > Naming (ported) > plural",
  "NamingWithNamespacedModelInIsolatedNamespaceTest > route key": "ActiveModel > Naming (ported) > route key",
  "NamingWithNamespacedModelInIsolatedNamespaceTest > singular": "ActiveModel > Naming (ported) > singular",
  "NamingWithNamespacedModelTest > singular": "ActiveModel > Naming (advanced) > NamingWithNamespacedModel singular",
  "NamingWithNamespacedModelTest > plural": "ActiveModel > Naming (advanced) > NamingWithNamespacedModel plural",
  "NestedErrorTest > NestedError initialize": "ActiveModel > NestedError > NestedError initialize",
  "NestedErrorTest > NestedError message": "ActiveModel > NestedError > NestedError message",
  "NestedErrorTest > NestedError full message": "ActiveModel > NestedError > NestedError full message",
  "NumericalityValidationTest > validates numericality with equal to": "ActiveModel > Validations Numericality (ported) > validates numericality with equal to",
  "NumericalityValidationTest > validates numericality with even": "ActiveModel > Validations Numericality (ported) > validates numericality with even",
  "NumericalityValidationTest > validates numericality with greater than": "ActiveModel > Validations Numericality (ported) > validates numericality with greater than",
  "NumericalityValidationTest > validates numericality with greater than less than and even": "ActiveModel > Validations Numericality (ported) > validates numericality with greater than less than and even",
  "NumericalityValidationTest > validates numericality with greater than or equal": "ActiveModel > Validations Numericality (ported) > validates numericality with greater than or equal",
  "NumericalityValidationTest > validates numericality with in": "ActiveModel > Validations Numericality (ported) > validates numericality with in",
  "NumericalityValidationTest > validates numericality with less than": "ActiveModel > Validations Numericality (ported) > validates numericality with less than",
  "NumericalityValidationTest > validates numericality with less than or equal to": "ActiveModel > Validators (extended) > numericality comparison operators > validates numericality with less than or equal to",
  "NumericalityValidationTest > validates numericality with odd": "ActiveModel > Validations Numericality (ported) > validates numericality with odd",
  "NumericalityValidationTest > validates numericality with other than": "ActiveModel > Validations Numericality (ported) > validates numericality with other than",
  "NumericalityValidationTest > validates numericality with proc": "ActiveModel > Validations (advanced features) > validates numericality with proc",
  "NumericalityValidationTest > validates numericality with symbol": "ActiveModel > Validations (advanced features) > validates numericality with symbol",
  "PresenceValidationTest > validate presences": "ActiveModel > Validations Presence (ported) > validate presences",
  "PresenceValidationTest > validates acceptance of with custom error using quotes": "ActiveModel > Validations Presence (ported) > validates acceptance of with custom error using quotes",
  "RegistryTest > a reasonable error is given when no type is found": "ActiveModel > Type Registry (ported) > a reasonable error is given when no type is found",
  "RegistryTest > a class can be registered for a symbol": "ActiveModel > Type Registry (ported) > a class can be registered for a symbol",
  "SerializationTest > method serializable hash should work with except and methods": "ActiveModel > Serialization (ported) > method serializable hash should work with except and methods",
  "AbsenceValidationTest > validates absence of with custom error using quotes": "ActiveModel > Validations Absence (ported) > validates absence of with custom error using quotes",
  "AcceptanceValidationTest > validates acceptance of true": "ActiveModel > Validations Acceptance (ported) > validates acceptance of true",
  "AcceptanceValidationTest > terms of service agreement with multiple accept values": "ActiveModel > Validations Acceptance (ported) > terms of service agreement with multiple accept values",
  "ActiveModelI18nTests > translated model attributes": "ActiveModel > Translation (basic) > translated model attributes",
  "ActiveModelI18nTests > translated model attributes with default": "ActiveModel > Translation (basic) > translated model attributes with default",
  "ActiveModelI18nTests > translated model when missing translation": "ActiveModel > Translation (basic) > translated model when missing translation",
  "ValidatesTest > validates with built in validation": "ActiveModel > Validations Validates (ported) > validates with built in validation",
  "ValidatesTest > validates with if as local conditions": "ActiveModel > Validations Validates (ported) > validates with if as local conditions",
  "ValidatesTest > validates with unless as local conditions": "ActiveModel > Validations Validates (ported) > validates with unless as local conditions",
  "ValidatesTest > validates with validator class": "ActiveModel > Validations (advanced features) > validates with validator class",
  "ValidatesTest > validates with namespaced validator class": "ActiveModel > Validations (advanced features) > validates with namespaced validator class",
  "ValidatesTest > validates with unknown validator": "ActiveModel > Validations (advanced features) > validates with unknown validator",
  "ValidatesTest > validates with disabled unknown validator": "ActiveModel > Validations (advanced features) > validates with disabled unknown validator",
  "ValidatesWithTest > with a class that returns valid": "ActiveModel > Validations With Validation (ported) > with a class that returns valid",
  "ValidationsContextTest > with a class that adds errors on create and validating a new model": "ActiveModel > Validations Context (ported) > with a class that adds errors on create and validating a new model",
  "ValidationsTest > single field validation": "ActiveModel > Validations (ported) > single field validation",
  "ValidationsTest > single attr validation and error msg": "ActiveModel > Validations (ported) > single attr validation and error msg",
  "ValidationsTest > double attr validation and error msg": "ActiveModel > Validations (ported) > double attr validation and error msg",
  "ValidationsTest > errors on base": "ActiveModel > Validations (ported) > errors on base",
  "ValidationsTest > errors empty after errors on check": "ActiveModel > Validations (ported) > errors empty after errors on check",
  "ValidationsTest > validates each": "ActiveModel > Validations (ported) > validates each",
  "ValidationsTest > validate block": "ActiveModel > Validations (ported) > validate block",
  "ValidationsTest > validate block with params": "ActiveModel > Validations (ported) > validate block with params",
  "ValidationsTest > invalid should be the opposite of valid": "ActiveModel > Validations (ported) > invalid should be the opposite of valid",
  "ValidationsTest > validation order": "ActiveModel > Validations (ported) > validation order",
  "ValidationsTest > validation with if and on": "ActiveModel > Validations (ported) > validation with if and on",
  "ValidationsTest > list of validators for model": "ActiveModel > Validations (ported) > list of validators for model",
  "ValidationsTest > list of validators on an attribute": "ActiveModel > Validations (ported) > list of validators on an attribute",
  "ValidationsTest > list of validators will be empty when empty": "ActiveModel > Validations (ported) > list of validators will be empty when empty",
  "ValidationsTest > validate with bang": "ActiveModel > Validations (ported) > validate with bang",
  "ValidationsTest > errors to json": "ActiveModel > Validations (ported) > errors to json",
  "ValidationsTest > does not modify options argument": "ActiveModel > Validations (ported) > does not modify options argument",
  "ValidationsTest > validates with false hash value": "ActiveModel > Validations (ported) > validates with false hash value",
  "ValidationsTest > dup validity is independent": "ActiveModel > Validations (advanced features) > dup validity is independent",
  "ValidationsTest > frozen models can be validated": "ActiveModel > Validations (advanced features) > frozen models can be validated",
  "ValidationsTest > validations on the instance level": "ActiveModel > Validations (advanced features) > validations on the instance level",
  "ValidationsTest > validate with except on": "ActiveModel > Validations (advanced features) > validate with except on",
  "ValidationsTest > validation with message as proc": "ActiveModel > Validations (advanced features) > validation with message as proc",
  "ValueTest > type equality": "ActiveModel > Type Value > type equality",
  "ValueTest > as json not defined": "ActiveModel > Type Value > as json not defined",
  "APITest > initialize with params and mixins reversed": "ActiveModel > APITest > initialize with params and mixins reversed",
  "APITest > mixin initializer when args exist": "ActiveModel > APITest > mixin initializer when args exist",
  "APITest > mixin initializer when args dont exist": "ActiveModel > APITest > mixin initializer when args dont exist",
  "AttributeAssignmentTest > simple assignment alias": "ActiveModel > AttributeAssignmentTest > simple assignment alias",
  "AttributeAssignmentTest > assign non-existing attribute": "ActiveModel > AttributeAssignmentTest > assign non-existing attribute",
  "AttributeAssignmentTest > assign non-existing attribute by overriding #attribute_writer_missing": "ActiveModel > AttributeAssignmentTest > assign non-existing attribute by overriding #attribute_writer_missing",
  "AttributeAssignmentTest > assign private attribute": "ActiveModel > AttributeAssignmentTest > assign private attribute",
  "AttributeAssignmentTest > does not swallow errors raised in an attribute writer": "ActiveModel > AttributeAssignmentTest > does not swallow errors raised in an attribute writer",
  "AttributeAssignmentTest > an ArgumentError is raised if a non-hash-like object is passed": "ActiveModel > AttributeAssignmentTest > an ArgumentError is raised if a non-hash-like object is passed",
  "AttributeAssignmentTest > forbidden attributes cannot be used for mass assignment": "ActiveModel > AttributeAssignmentTest > forbidden attributes cannot be used for mass assignment",
  "AttributeAssignmentTest > permitted attributes can be used for mass assignment": "ActiveModel > AttributeAssignmentTest > permitted attributes can be used for mass assignment",
  "AttributeAssignmentTest > assigning no attributes should not raise, even if the hash is un-permitted": "ActiveModel > AttributeAssignmentTest > assigning no attributes should not raise, even if the hash is un-permitted",
  "AttributeAssignmentTest > passing an object with each_pair but without each": "ActiveModel > AttributeAssignmentTest > passing an object with each_pair but without each",
  "AttributeMethodsTest > #define_attribute_method does not generate attribute method if already defined in attribute module": "ActiveModel > AttributeMethodsTest > #define_attribute_method does not generate attribute method if already defined in attribute module",
  "AttributeMethodsTest > #define_attribute_method generates a method that is already defined on the host": "ActiveModel > AttributeMethodsTest > #define_attribute_method generates a method that is already defined on the host",
  "AttributeMethodsTest > #define_attribute_method generates attribute method with invalid identifier characters": "ActiveModel > AttributeMethodsTest > #define_attribute_method generates attribute method with invalid identifier characters",
  "AttributeMethodsTest > #define_attribute_methods works passing multiple arguments": "ActiveModel > AttributeMethodsTest > #define_attribute_methods works passing multiple arguments",
  "AttributeMethodsTest > #define_attribute_methods generates attribute methods": "ActiveModel > AttributeMethodsTest > #define_attribute_methods generates attribute methods",
  "AttributeMethodsTest > #alias_attribute generates attribute_aliases lookup hash": "ActiveModel > AttributeMethodsTest > #alias_attribute generates attribute_aliases lookup hash",
  "AttributeMethodsTest > #define_attribute_methods generates attribute methods with spaces in their names": "ActiveModel > AttributeMethodsTest > #define_attribute_methods generates attribute methods with spaces in their names",
  "AttributeMethodsTest > #alias_attribute works with attributes with spaces in their names": "ActiveModel > AttributeMethodsTest > #alias_attribute works with attributes with spaces in their names",
  "AttributeMethodsTest > #alias_attribute works with attributes named as a ruby keyword": "ActiveModel > AttributeMethodsTest > #alias_attribute works with attributes named as a ruby keyword",
  "AttributeMethodsTest > #undefine_attribute_methods undefines alias attribute methods": "ActiveModel > AttributeMethodsTest > #undefine_attribute_methods undefines alias attribute methods",
  "AttributeMethodsTest > defined attribute doesn't expand positional hash argument": "ActiveModel > AttributeMethodsTest > defined attribute doesn't expand positional hash argument",
  "AttributeMethodsTest > should not interfere with respond_to? if the attribute has a private/protected method": "ActiveModel > AttributeMethodsTest > should not interfere with respond_to? if the attribute has a private/protected method",
  "AttributeMethodsTest > alias attribute respects user defined method": "ActiveModel > AttributeMethodsTest > alias attribute respects user defined method",
  "AttributeMethodsTest > alias attribute respects user defined method in parent classes": "ActiveModel > AttributeMethodsTest > alias attribute respects user defined method in parent classes",
  "AttributeRegistrationTest > attributes can be registered": "ActiveModel > AttributeRegistrationTest > attributes can be registered",
  "AttributeRegistrationTest > type options are forwarded when type is specified by name": "ActiveModel > AttributeRegistrationTest > type options are forwarded when type is specified by name",
  "AttributeRegistrationTest > default value can be specified": "ActiveModel > AttributeRegistrationTest > default value can be specified",
  "AttributeRegistrationTest > default value can be nil": "ActiveModel > AttributeRegistrationTest > default value can be nil",
  "AttributeRegistrationTest > .type_for_attribute returns the default type when an unregistered attribute is specified": "ActiveModel > AttributeRegistrationTest > .type_for_attribute returns the default type when an unregistered attribute is specified",
  "AttributeRegistrationTest > new attributes can be registered at any time": "ActiveModel > AttributeRegistrationTest > new attributes can be registered at any time",
  "AttributeRegistrationTest > attributes are inherited": "ActiveModel > AttributeRegistrationTest > attributes are inherited",
  "AttributeRegistrationTest > subclass attributes do not affect superclass": "ActiveModel > AttributeRegistrationTest > subclass attributes do not affect superclass",
  "AttributeRegistrationTest > new superclass attributes are inherited even after subclass attributes are registered": "ActiveModel > AttributeRegistrationTest > new superclass attributes are inherited even after subclass attributes are registered",
  "AttributeRegistrationTest > new superclass attributes do not override subclass attributes": "ActiveModel > AttributeRegistrationTest > new superclass attributes do not override subclass attributes",
  "AttributeRegistrationTest > superclass attributes can be overridden": "ActiveModel > AttributeRegistrationTest > superclass attributes can be overridden",
  "AttributeRegistrationTest > superclass default values can be overridden": "ActiveModel > AttributeRegistrationTest > superclass default values can be overridden",
  "AttributeRegistrationTest > .decorate_attributes decorates all attributes when none are specified": "ActiveModel > AttributeRegistrationTest > .decorate_attributes decorates all attributes when none are specified",
  "AttributeRegistrationTest > .decorate_attributes supports conditional decoration": "ActiveModel > AttributeRegistrationTest > .decorate_attributes supports conditional decoration",
  "AttributeRegistrationTest > superclass attribute types can be decorated": "ActiveModel > AttributeRegistrationTest > superclass attribute types can be decorated",
  "AttributeTest > reading memoizes falsy values": "ActiveModel > AttributeTest > reading memoizes falsy values",
  "AttributeTest > from_user + value_for_database type casts from the user to the database": "ActiveModel > AttributeTest > from_user + value_for_database type casts from the user to the database",
  "AttributeTest > from_user + value_for_database uses serialize_cast_value when possible": "ActiveModel > AttributeTest > from_user + value_for_database uses serialize_cast_value when possible",
  "AttributeTest > value_for_database is memoized": "ActiveModel > AttributeTest > value_for_database is memoized",
  "AttributeTest > value_for_database is recomputed when value changes in place": "ActiveModel > AttributeTest > value_for_database is recomputed when value changes in place",
  "AttributeTest > duping does not dup the value if it is not dupable": "ActiveModel > AttributeTest > duping does not dup the value if it is not dupable",
  "AttributeTest > duping does not eagerly type cast if we have not yet type cast": "ActiveModel > AttributeTest > duping does not eagerly type cast if we have not yet type cast",
  "AttributeTest > uninitialized attributes yield their name if a block is given to value": "ActiveModel > AttributeTest > uninitialized attributes yield their name if a block is given to value",
  "AttributeTest > attributes do not equal attributes with different names": "ActiveModel > AttributeTest > attributes do not equal attributes with different names",
  "AttributeTest > attributes do not equal attributes with different types": "ActiveModel > AttributeTest > attributes do not equal attributes with different types",
  "AttributeTest > attributes do not equal attributes with different values": "ActiveModel > AttributeTest > attributes do not equal attributes with different values",
  "AttributeTest > attributes do not equal attributes of other classes": "ActiveModel > AttributeTest > attributes do not equal attributes of other classes",
  "AttributeTest > an attribute has been read when its value is calculated": "ActiveModel > AttributeTest > an attribute has been read when its value is calculated",
  "AttributeTest > an attribute is not changed if it hasn't been assigned or mutated": "ActiveModel > AttributeTest > an attribute is not changed if it hasn't been assigned or mutated",
  "AttributeTest > an attribute is changed if it's been assigned a new value": "ActiveModel > AttributeTest > an attribute is changed if it's been assigned a new value",
  "AttributeTest > an attribute is not changed if it's assigned the same value": "ActiveModel > AttributeTest > an attribute is not changed if it's assigned the same value",
  "AttributeTest > an attribute cannot be mutated if it has not been read,\n      and skips expensive calculations": "ActiveModel > AttributeTest > an attribute cannot be mutated if it has not been read, and skips expensive calculations",
  "AttributeTest > an attribute is changed if it has been mutated": "ActiveModel > AttributeTest > an attribute is changed if it has been mutated",
  "AttributeTest > an attribute can forget its changes": "ActiveModel > AttributeTest > an attribute can forget its changes",
  "AttributeTest > #forgetting_assignment on an unchanged .from_database attribute re-deserializes its value": "ActiveModel > AttributeTest > #forgetting_assignment on an unchanged .from_database attribute re-deserializes its value",
  "AttributeTest > with_value_from_user validates the value": "ActiveModel > AttributeTest > with_value_from_user validates the value",
  "AttributesDirtyTest > changes accessible through both strings and symbols": "ActiveModel > AttributesDirtyTest > changes accessible through both strings and symbols",
  "AttributesDirtyTest > be consistent with symbols arguments after the changes are applied": "ActiveModel > AttributesDirtyTest > be consistent with symbols arguments after the changes are applied",
  "AttributesDirtyTest > restore_attributes can restore only some attributes": "ActiveModel > AttributesDirtyTest > restore_attributes can restore only some attributes",
  "AttributesDirtyTest > changing the attribute reports a change only when the cast value changes": "ActiveModel > AttributesDirtyTest > changing the attribute reports a change only when the cast value changes",
  "AttributesTest > models that proxy attributes do not conflict with models with generated methods": "ActiveModel > AttributesTest > models that proxy attributes do not conflict with models with generated methods",
  "AttributesTest > nonexistent attribute": "ActiveModel > AttributesTest > nonexistent attribute",
  "AttributesTest > attributes with proc defaults can be marshalled": "ActiveModel > AttributesTest > attributes with proc defaults can be marshalled",
  "AttributesTest > can't modify attributes if frozen": "ActiveModel > AttributesTest > can't modify attributes if frozen",
  "AttributesTest > attributes can be frozen again": "ActiveModel > AttributesTest > attributes can be frozen again",
  "AttributesTest > .type_for_attribute supports attribute aliases": "ActiveModel > AttributesTest > .type_for_attribute supports attribute aliases",
  "NamingWithSuppliedModelNameTest > singular": "ActiveModel > NamingWithSuppliedModelNameTest > singular",
  "NamingWithSuppliedModelNameTest > plural": "ActiveModel > NamingWithSuppliedModelNameTest > plural",
  "NamingWithSuppliedModelNameTest > element": "ActiveModel > NamingWithSuppliedModelNameTest > element",
  "NamingWithSuppliedModelNameTest > collection": "ActiveModel > NamingWithSuppliedModelNameTest > collection",
  "NamingWithSuppliedModelNameTest > human": "ActiveModel > NamingWithSuppliedModelNameTest > human",
  "NamingWithSuppliedModelNameTest > route key": "ActiveModel > NamingWithSuppliedModelNameTest > route key",
  "NamingWithSuppliedModelNameTest > param key": "ActiveModel > NamingWithSuppliedModelNameTest > param key",
  "NamingWithSuppliedModelNameTest > i18n key": "ActiveModel > NamingWithSuppliedModelNameTest > i18n key",
  "NamingWithSuppliedLocaleTest > singular": "ActiveModel > NamingWithSuppliedLocaleTest > singular",
  "NamingWithSuppliedLocaleTest > plural": "ActiveModel > NamingWithSuppliedLocaleTest > plural",
  "NamingUsingRelativeModelNameTest > singular": "ActiveModel > NamingUsingRelativeModelNameTest > singular",
  "NamingUsingRelativeModelNameTest > plural": "ActiveModel > NamingUsingRelativeModelNameTest > plural",
  "NamingUsingRelativeModelNameTest > element": "ActiveModel > NamingUsingRelativeModelNameTest > element",
  "NamingUsingRelativeModelNameTest > collection": "ActiveModel > NamingUsingRelativeModelNameTest > collection",
  "NamingUsingRelativeModelNameTest > human": "ActiveModel > NamingUsingRelativeModelNameTest > human",
  "NamingUsingRelativeModelNameTest > route key": "ActiveModel > NamingUsingRelativeModelNameTest > route key",
  "NamingUsingRelativeModelNameTest > param key": "ActiveModel > NamingUsingRelativeModelNameTest > param key",
  "NamingUsingRelativeModelNameTest > i18n key": "ActiveModel > NamingUsingRelativeModelNameTest > i18n key",
  "NamingWithNamespacedModelInIsolatedNamespaceTest > human": "ActiveModel > NamingWithNamespacedModelInIsolatedNamespaceTest > human",
  "OverridingAccessorsTest > overriding accessors keys": "ActiveModel > OverridingAccessorsTest > overriding accessors keys",
  "CallbacksTest > after callbacks are not executed if the block returns false": "ActiveModel > CallbacksTest > after callbacks are not executed if the block returns false",
  "CallbacksTest > only selects which types of callbacks should be created from an array list": "ActiveModel > CallbacksTest > only selects which types of callbacks should be created from an array list",
  "CallbacksTest > no callbacks should be created": "ActiveModel > CallbacksTest > no callbacks should be created",
  "CallbacksTest > after_create callbacks with both callbacks declared in different lines": "ActiveModel > CallbacksTest > after_create callbacks with both callbacks declared in different lines",
  "CallbacksWithMethodNamesShouldBeCalled > on condition is respected for validation without matching context": "ActiveModel > CallbacksWithMethodNamesShouldBeCalled > on condition is respected for validation without matching context",
  "CallbacksWithMethodNamesShouldBeCalled > on condition is respected for validation without context": "ActiveModel > CallbacksWithMethodNamesShouldBeCalled > on condition is respected for validation without context",
  "CallbacksWithMethodNamesShouldBeCalled > on multiple condition is respected for validation with matching context": "ActiveModel > CallbacksWithMethodNamesShouldBeCalled > on multiple condition is respected for validation with matching context",
  "CallbacksWithMethodNamesShouldBeCalled > on multiple condition is respected for validation without matching context": "ActiveModel > CallbacksWithMethodNamesShouldBeCalled > on multiple condition is respected for validation without matching context",
  "CallbacksWithMethodNamesShouldBeCalled > on multiple condition is respected for validation without context": "ActiveModel > CallbacksWithMethodNamesShouldBeCalled > on multiple condition is respected for validation without context",
  "CallbacksWithMethodNamesShouldBeCalled > further callbacks should be called if before validation returns false": "ActiveModel > CallbacksWithMethodNamesShouldBeCalled > further callbacks should be called if before validation returns false",
  "CallbacksWithMethodNamesShouldBeCalled > further callbacks should be called if after validation returns false": "ActiveModel > CallbacksWithMethodNamesShouldBeCalled > further callbacks should be called if after validation returns false",
  "CallbacksWithMethodNamesShouldBeCalled > before validation does not mutate the if options array": "ActiveModel > CallbacksWithMethodNamesShouldBeCalled > before validation does not mutate the if options array",
  "CallbacksWithMethodNamesShouldBeCalled > after validation does not mutate the if options array": "ActiveModel > CallbacksWithMethodNamesShouldBeCalled > after validation does not mutate the if options array",
  "ConversionTest > to_key doesn't double-wrap composite `id`s": "ActiveModel > ConversionTest > to_key doesn't double-wrap composite `id`s",
  "ConversionTest > to_param returns nil if composite id is incomplete": "ActiveModel > ConversionTest > to_param returns nil if composite id is incomplete",
  "ConversionTest > to_partial_path handles non-standard model_name": "ActiveModel > ConversionTest > to_partial_path handles non-standard model_name",
  "ConversionTest > #to_param_delimiter is defined per class": "ActiveModel > ConversionTest > #to_param_delimiter is defined per class",
  "DirtyTest > changes accessible through both strings and symbols": "ActiveModel > DirtyTest > changes accessible through both strings and symbols",
  "DirtyTest > be consistent with symbols arguments after the changes are applied": "ActiveModel > DirtyTest > be consistent with symbols arguments after the changes are applied",
  "DirtyTest > restore_attributes can restore only some attributes": "ActiveModel > DirtyTest > restore_attributes can restore only some attributes",
  "ErrorTest > match? handles extra options match": "ActiveModel > ErrorTest > match? handles extra options match",
  "ErrorTest > message handles lambda in messages and option values, and i18n interpolation": "ActiveModel > ErrorTest > message handles lambda in messages and option values, and i18n interpolation",
  "ErrorTest > message with type as a symbol and indexed attribute can lookup without index in attribute key": "ActiveModel > ErrorTest > message with type as a symbol and indexed attribute can lookup without index in attribute key",
  "ErrorsTest > add, type being Proc, which evaluates to Symbol": "ActiveModel > ErrorsTest > add, type being Proc, which evaluates to Symbol",
  "ErrorsTest > add, with options[:message] as Proc, which evaluates to String, where type is nil": "ActiveModel > ErrorsTest > add, with options[:message] as Proc, which evaluates to String, where type is nil",
  "ErrorsTest > errors are compatible with YAML dumped from Rails 6.x": "ActiveModel > ErrorsTest > errors are compatible with YAML dumped from Rails 6.x",
  "SerializationTest > should raise NoMethodError for non existing method": "ActiveModel > SerializationTest > should raise NoMethodError for non existing method",
  "SerializationTest > multiple includes": "ActiveModel > SerializationTest > multiple includes",
  "SerializationTest > nested include": "ActiveModel > SerializationTest > nested include",
  "SerializationTest > multiple includes with options": "ActiveModel > SerializationTest > multiple includes with options",
  "SerializationTest > all includes with options": "ActiveModel > SerializationTest > all includes with options",
  "JsonSerializationTest > should return Hash for errors": "ActiveModel > JsonSerializationTest > should return Hash for errors",
  "JsonSerializationTest > custom as_json should be honored when generating json": "ActiveModel > JsonSerializationTest > custom as_json should be honored when generating json",
  "JsonSerializationTest > custom as_json options should be extensible": "ActiveModel > JsonSerializationTest > custom as_json options should be extensible",
  "ActiveModelI18nTests > translated model attributes using default option": "ActiveModel > ActiveModelI18nTests > translated model attributes using default option",
  "ActiveModelI18nTests > translated model attributes using default option as symbol": "ActiveModel > ActiveModelI18nTests > translated model attributes using default option as symbol",
  "ActiveModelI18nTests > translated model attributes falling back to default": "ActiveModel > ActiveModelI18nTests > translated model attributes falling back to default",
  "ActiveModelI18nTests > translated model attributes using default option as symbol and falling back to default": "ActiveModel > ActiveModelI18nTests > translated model attributes using default option as symbol and falling back to default",
  "ActiveModelI18nTests > translated model attributes with ancestors fallback": "ActiveModel > ActiveModelI18nTests > translated model attributes with ancestors fallback",
  "ActiveModelI18nTests > translated model attributes with attribute matching namespaced model name": "ActiveModel > ActiveModelI18nTests > translated model attributes with attribute matching namespaced model name",
  "ActiveModelI18nTests > translated deeply nested model attributes": "ActiveModel > ActiveModelI18nTests > translated deeply nested model attributes",
  "ActiveModelI18nTests > translated nested model attributes": "ActiveModel > ActiveModelI18nTests > translated nested model attributes",
  "ActiveModelI18nTests > translated nested model attributes with namespace fallback": "ActiveModel > ActiveModelI18nTests > translated nested model attributes with namespace fallback",
  "ActiveModelI18nTests > translated model with namespace": "ActiveModel > ActiveModelI18nTests > translated model with namespace",
  "ActiveModelI18nTests > translated subclass model": "ActiveModel > ActiveModelI18nTests > translated subclass model",
  "ActiveModelI18nTests > translated subclass model when ancestor translation": "ActiveModel > ActiveModelI18nTests > translated subclass model when ancestor translation",
  "ActiveModelI18nTests > translated attributes when nil": "ActiveModel > ActiveModelI18nTests > translated attributes when nil",
  "ActiveModelI18nTests > translated deeply nested attributes when nil": "ActiveModel > ActiveModelI18nTests > translated deeply nested attributes when nil",
  "ActiveModelI18nTests > translated subclass model when missing translation": "ActiveModel > ActiveModelI18nTests > translated subclass model when missing translation",
  "ActiveModelI18nTests > translated model with default value when missing translation": "ActiveModel > ActiveModelI18nTests > translated model with default value when missing translation",
  "ActiveModelI18nTests > translated model with default key when missing both translations": "ActiveModel > ActiveModelI18nTests > translated model with default key when missing both translations",
  "ActiveModelI18nTests > human does not modify options": "ActiveModel > ActiveModelI18nTests > human does not modify options",
  "ActiveModelI18nTests > human attribute name does not modify options": "ActiveModel > ActiveModelI18nTests > human attribute name does not modify options",
  "ActiveModelI18nTests > raise on missing translations": "ActiveModel > ActiveModelI18nTests > raise on missing translations",
  "DecimalTest > type cast from float with unspecified precision": "ActiveModel > DecimalTest > type cast from float with unspecified precision",
  "DecimalTest > type cast decimal from rational with precision and scale": "ActiveModel > DecimalTest > type cast decimal from rational with precision and scale",
  "DecimalTest > type cast decimal from rational without precision defaults to 18 36": "ActiveModel > DecimalTest > type cast decimal from rational without precision defaults to 18 36",
  "DecimalTest > type cast decimal from object responding to d": "ActiveModel > DecimalTest > type cast decimal from object responding to d",
  "DecimalTest > changed?": "ActiveModel > DecimalTest > changed?",
  "DecimalTest > scale is applied before precision to prevent rounding errors": "ActiveModel > DecimalTest > scale is applied before precision to prevent rounding errors",
  "FloatTest > changing float": "ActiveModel > FloatTest > changing float",
  "RegistryTest > a block can be registered": "ActiveModel > RegistryTest > a block can be registered",
  "AbsenceValidationTest > validates absence of for ruby class with custom reader": "ActiveModel > AbsenceValidationTest > validates absence of for ruby class with custom reader",
  "AcceptanceValidationTest > lazy attribute module included only once": "ActiveModel > AcceptanceValidationTest > lazy attribute module included only once",
  "AcceptanceValidationTest > lazy attributes module included again if needed": "ActiveModel > AcceptanceValidationTest > lazy attributes module included again if needed",
  "AcceptanceValidationTest > lazy attributes respond to?": "ActiveModel > AcceptanceValidationTest > lazy attributes respond to?",
  "ComparisonValidationTest > validates comparison with less than or equal to using time": "ActiveModel > ComparisonValidationTest > validates comparison with less than or equal to using time",
  "ComparisonValidationTest > validates comparison with less than or equal to using string": "ActiveModel > ComparisonValidationTest > validates comparison with less than or equal to using string",
  "ComparisonValidationTest > validates comparison with other than using date": "ActiveModel > ComparisonValidationTest > validates comparison with other than using date",
  "ComparisonValidationTest > validates comparison with other than using time": "ActiveModel > ComparisonValidationTest > validates comparison with other than using time",
  "ComparisonValidationTest > validates comparison with other than using string": "ActiveModel > ComparisonValidationTest > validates comparison with other than using string",
  "ComparisonValidationTest > validates comparison with custom compare": "ActiveModel > ComparisonValidationTest > validates comparison with custom compare",
  "ComparisonValidationTest > validates comparison of incomparables": "ActiveModel > ComparisonValidationTest > validates comparison of incomparables",
  "ComparisonValidationTest > validates comparison of no options": "ActiveModel > ComparisonValidationTest > validates comparison of no options",
  "ComparisonValidationTest > validates comparison with blank allowed": "ActiveModel > ComparisonValidationTest > validates comparison with blank allowed",
  "ConfirmationValidationTest > does not override confirmation reader if present": "ActiveModel > ConfirmationValidationTest > does not override confirmation reader if present",
  "ConfirmationValidationTest > does not override confirmation writer if present": "ActiveModel > ConfirmationValidationTest > does not override confirmation writer if present",
  "ExclusionValidationTest > validates exclusion of beginless numeric range": "ActiveModel > ExclusionValidationTest > validates exclusion of beginless numeric range",
  "ExclusionValidationTest > validates exclusion of endless numeric range": "ActiveModel > ExclusionValidationTest > validates exclusion of endless numeric range",
  "ExclusionValidationTest > validates exclusion of with time range": "ActiveModel > ExclusionValidationTest > validates exclusion of with time range",
  "FormatValidationTest > validates format of with both regexps should raise error": "ActiveModel > FormatValidationTest > validates format of with both regexps should raise error",
  "FormatValidationTest > validates format of when with isnt a regexp should raise error": "ActiveModel > FormatValidationTest > validates format of when with isnt a regexp should raise error",
  "FormatValidationTest > validates format of when not isnt a regexp should raise error": "ActiveModel > FormatValidationTest > validates format of when not isnt a regexp should raise error",
  "FormatValidationTest > validates format of without lambda": "ActiveModel > FormatValidationTest > validates format of without lambda",
  "FormatValidationTest > validates format of without lambda without arguments": "ActiveModel > FormatValidationTest > validates format of without lambda without arguments",
  "InclusionValidationTest > validates inclusion of date time range": "ActiveModel > InclusionValidationTest > validates inclusion of date time range",
  "InclusionValidationTest > validates inclusion of beginless numeric range": "ActiveModel > InclusionValidationTest > validates inclusion of beginless numeric range",
  "InclusionValidationTest > validates inclusion of endless numeric range": "ActiveModel > InclusionValidationTest > validates inclusion of endless numeric range",
  "LengthValidationTest > validates length of using bignum": "ActiveModel > LengthValidationTest > validates length of using bignum",
  "LengthValidationTest > validates length of nasty params": "ActiveModel > LengthValidationTest > validates length of nasty params",
  "LengthValidationTest > optionally validates length of using within utf8": "ActiveModel > LengthValidationTest > optionally validates length of using within utf8",
  "LengthValidationTest > validates length of using is utf8": "ActiveModel > LengthValidationTest > validates length of using is utf8",
  "LengthValidationTest > validates length of for ruby class": "ActiveModel > LengthValidationTest > validates length of for ruby class",
  "LengthValidationTest > validates length of using maximum should not allow nil and empty string when blank not allowed": "ActiveModel > LengthValidationTest > validates length of using maximum should not allow nil and empty string when blank not allowed",
  "LengthValidationTest > validates length of using minimum 0 should not allow nil": "ActiveModel > LengthValidationTest > validates length of using minimum 0 should not allow nil",
  "LengthValidationTest > validates length of using is 0 should not allow nil": "ActiveModel > LengthValidationTest > validates length of using is 0 should not allow nil",
  "LengthValidationTest > validates with diff in option": "ActiveModel > LengthValidationTest > validates with diff in option",
  "LengthValidationTest > validates length of using symbol as maximum": "ActiveModel > LengthValidationTest > validates length of using symbol as maximum",
  "NumericalityValidationTest > validates numericality with less than using differing numeric types": "ActiveModel > NumericalityValidationTest > validates numericality with less than using differing numeric types",
  "NumericalityValidationTest > validates numericality with less than or equal to using differing numeric types": "ActiveModel > NumericalityValidationTest > validates numericality with less than or equal to using differing numeric types",
  "NumericalityValidationTest > validates numericality of for ruby class": "ActiveModel > NumericalityValidationTest > validates numericality of for ruby class",
  "NumericalityValidationTest > validates numericality using value before type cast if possible": "ActiveModel > NumericalityValidationTest > validates numericality using value before type cast if possible",
  "NumericalityValidationTest > validates numericality with object acting as numeric": "ActiveModel > NumericalityValidationTest > validates numericality with object acting as numeric",
  "NumericalityValidationTest > validates numericality with invalid args": "ActiveModel > NumericalityValidationTest > validates numericality with invalid args",
  "NumericalityValidationTest > validates numericality equality for float and big decimal": "ActiveModel > NumericalityValidationTest > validates numericality equality for float and big decimal",
  "PresenceValidationTest > validates presence of for ruby class with custom reader": "ActiveModel > PresenceValidationTest > validates presence of for ruby class with custom reader",
  "PresenceValidationTest > validates presence of with allow nil option": "ActiveModel > PresenceValidationTest > validates presence of with allow nil option",
  "PresenceValidationTest > validates presence of with allow blank option": "ActiveModel > PresenceValidationTest > validates presence of with allow blank option",
  "ValidatesTest > validates with messages empty": "ActiveModel > ValidatesTest > validates with messages empty",
  "ValidatesTest > validates with attribute specified as string": "ActiveModel > ValidatesTest > validates with attribute specified as string",
  "ValidatesTest > validates with unless shared conditions": "ActiveModel > ValidatesTest > validates with unless shared conditions",
  "ValidatesTest > validates with regexp": "ActiveModel > ValidatesTest > validates with regexp",
  "ValidatesTest > validates with array": "ActiveModel > ValidatesTest > validates with array",
  "ValidatesTest > validates with range": "ActiveModel > ValidatesTest > validates with range",
  "ValidatesTest > validates with included validator": "ActiveModel > ValidatesTest > validates with included validator",
  "ValidatesTest > validates with included validator and options": "ActiveModel > ValidatesTest > validates with included validator and options",
  "ValidatesTest > validates with included validator and wildcard shortcut": "ActiveModel > ValidatesTest > validates with included validator and wildcard shortcut",
  "ValidatesTest > defining extra default keys for validates": "ActiveModel > ValidatesTest > defining extra default keys for validates",
  "ValidatesWithTest > validates_with preserves standard options": "ActiveModel > ValidatesWithTest > validates_with preserves standard options",
  "ValidatesWithTest > validates_with preserves validator options": "ActiveModel > ValidatesWithTest > validates_with preserves validator options",
  "ValidatesWithTest > instance validates_with method preserves validator options": "ActiveModel > ValidatesWithTest > instance validates_with method preserves validator options",
  "ValidatesWithTest > each validator checks validity": "ActiveModel > ValidatesWithTest > each validator checks validity",
  "ValidatesWithTest > each validator expects attributes to be given": "ActiveModel > ValidatesWithTest > each validator expects attributes to be given",
  "ValidatesWithTest > each validator skip nil values if :allow_nil is set to true": "ActiveModel > ValidatesWithTest > each validator skip nil values if :allow_nil is set to true",
  "ValidatesWithTest > each validator skip blank values if :allow_blank is set to true": "ActiveModel > ValidatesWithTest > each validator skip blank values if :allow_blank is set to true",
  "ValidatesWithTest > validates_with can validate with an instance method": "ActiveModel > ValidatesWithTest > validates_with can validate with an instance method",
  "ValidatesWithTest > optionally pass in the attribute being validated when validating with an instance method": "ActiveModel > ValidatesWithTest > optionally pass in the attribute being validated when validating with an instance method",
  "ValidationsTest > errors on nested attributes expands name": "ActiveModel > ValidationsTest > errors on nested attributes expands name",
  "ValidationsTest > validates each custom reader": "ActiveModel > ValidationsTest > validates each custom reader",
  "ValidationsTest > validates with array condition does not mutate the array": "ActiveModel > ValidationsTest > validates with array condition does not mutate the array",
  "ValidationsTest > invalid validator": "ActiveModel > ValidationsTest > invalid validator",
  "ValidationsTest > invalid options to validate": "ActiveModel > ValidationsTest > invalid options to validate",
  "ValidationsTest > callback options to validate": "ActiveModel > ValidationsTest > callback options to validate",
  "ValidationsTest > accessing instance of validator on an attribute": "ActiveModel > ValidationsTest > accessing instance of validator on an attribute",
  "ValidationsTest > strict validation in custom validator helper": "ActiveModel > ValidationsTest > strict validation in custom validator helper",
  "ValidationsTest > validation with message as proc that takes record and data as a parameters": "ActiveModel > ValidationsTest > validation with message as proc that takes record and data as a parameters",
  "ValidationsTest > validations some with except": "ActiveModel > ValidationsTest > validations some with except",
  "ModelTest > initialize with params and mixins reversed": "ActiveModel > ModelTest > initialize with params and mixins reversed",
  "ModelTest > mixin inclusion chain": "ActiveModel > ModelTest > mixin inclusion chain",
  "ModelTest > mixin initializer when args exist": "ActiveModel > ModelTest > mixin initializer when args exist",
  "ModelTest > mixin initializer when args dont exist": "ActiveModel > ModelTest > mixin initializer when args dont exist",

  // ==========================================================================
  // ActiveRecord overrides
  // ==========================================================================
  // --- base_test.rb ---
  "BasicsTest > toggle attribute": "ActiveRecord > Base: increment/decrement/toggle > toggle flips boolean",
  "BasicsTest > has attribute": "ActiveRecord > hasAttribute() > returns true for defined attributes",
  "BasicsTest > has attribute with symbol": "ActiveRecord > hasAttributeDefinition > returns true for defined attributes",
  "BasicsTest > attribute names": "ActiveRecord > attributeNames() > returns list of defined attribute names",
  "BasicsTest > attribute names on abstract class": "ActiveRecord > columnNames > returns the list of defined attribute names",
  "BasicsTest > initialize with attributes": "ActiveRecord > Base.new() > creates an unsaved record instance",
  "BasicsTest > equality": "ActiveRecord > Base#isEqual > returns true for same class and same id",
  "BasicsTest > equality of new records": "ActiveRecord > Base#isEqual > returns false for new records",
  "BasicsTest > dup": "ActiveRecord > dup() > creates an unsaved copy without primary key",
  "BasicsTest > reload": "ActiveRecord > Persistence edge cases > reload clears dirty tracking",
  "BasicsTest > last": "ActiveRecord > Relation (extended) > last returns the last record by PK",
  "BasicsTest > all": "ActiveRecord > Relation > all returns all records",
  "BasicsTest > distinct delegates to scoped": "ActiveRecord > distinct count > count with distinct uses COUNT(DISTINCT ...)",
  "BasicsTest > abstract class table name": "ActiveRecord > abstract_class > marks a class as abstract",
  "BasicsTest > #present? and #blank? on ActiveRecord::Base classes": "ActiveRecord > isBlank / isPresent > isBlank returns true when no records exist",
  "BasicsTest > select symbol": "ActiveRecord > Relation (extended) > select returns records with projected columns in SQL",
  "BasicsTest > limit should take value from latest limit": "ActiveRecord > Relation edge cases > limit overrides previous limit",
  "BasicsTest > table name based on model name": "ActiveRecord > Base > table name inference > table name guesses",
  "BasicsTest > switching between table name": "ActiveRecord > Base > table name inference > switching between table name",
  "BasicsTest > previously new record returns boolean": "ActiveRecord > previouslyNewRecord > returns true after first save",
  "BasicsTest > previously changed": "ActiveRecord > savedChanges > tracks changes from the last save",
  "BasicsTest > auto id": "ActiveRecord > Base > primary key > defaults to id",
  "BasicsTest > null fields": "ActiveRecord > Relation (extended) > where with null generates IS NULL",
  "BasicsTest > readonly attributes": "ActiveRecord > attrReadonly > ignores readonly attribute changes on update",
  "BasicsTest > readonly attributes on a new record": "ActiveRecord > attrReadonly > allows setting readonly attributes on create",
  "BasicsTest > scoped can take a values hash": "ActiveRecord > scopeForCreate / whereValuesHash > whereValuesHash returns the where conditions",
  "BasicsTest > records without an id have unique hashes": "ActiveRecord > Base#isEqual > returns false for new records",
  "BasicsTest > ignored columns are stored as an array of string": "ActiveRecord > ignoredColumns > can be set and retrieved on a model class",
  "BasicsTest > singular table name guesses for individual table": "ActiveRecord > Base features (Rails-guided) > table name guesses",
  "BasicsTest > quoted table name after set table name": "ActiveRecord > Base features (Rails-guided) > custom table name",
  // --- persistence_test.rb ---
  "PersistenceTest > create prefetched pk": "Persistence (Rails-guided) > createBang returns persisted record on success",
  "PersistenceTest > update!": "ActiveRecord > Base (extended) > updateBang throws on validation failure",
  "PersistenceTest > update attribute": "ActiveRecord > updateAttribute > updates a single attribute and saves, skipping validations",
  "PersistenceTest > save for record with only primary key": "ActiveRecord > Base > persistence > saveBang throws on validation failure",
  "PersistenceTest > save touch false": "ActiveRecord > save with touch: false > skips timestamp updates on save",
  "PersistenceTest > increment attribute": "ActiveRecord > Base: increment/decrement/toggle > increment attribute",
  "PersistenceTest > increment attribute by": "ActiveRecord > Base: increment/decrement/toggle > increment attribute by",
  "PersistenceTest > increment updates counter in db using offset": "ActiveRecord > Base: increment/decrement/toggle > increment attribute",
  "PersistenceTest > decrement attribute": "ActiveRecord > Base: increment/decrement/toggle > decrement attribute",
  "PersistenceTest > decrement attribute by": "ActiveRecord > Base: increment/decrement/toggle > decrement attribute by",
  "PersistenceTest > destroy!": "ActiveRecord > Base (extended) > destroyBang delegates to destroy",
  "PersistenceTest > class level delete": "ActiveRecord > Base (extended) > class level delete",
  "PersistenceTest > class level update without ids": "ActiveRecord > static update() > finds and updates a record by id",
  "PersistenceTest > delete all": "ActiveRecord > Relation (extended) > deleteAll returns the number of deleted rows",
  "PersistenceTest > update all": "ActiveRecord > Relation > update all",
  "PersistenceTest > update after create": "ActiveRecord > Persistence (Rails-guided) > update attribute",
  "PersistenceTest > update does not run sql if record has not changed": "ActiveRecord > Persistence (Rails-guided) > update does not run sql if record has not changed",
  "PersistenceTest > update attribute for readonly attribute": "ActiveRecord > attrReadonly > ignores readonly attribute changes on update",
  "PersistenceTest > update attribute for readonly attribute!": "ActiveRecord > attrReadonly > ignores readonly attribute changes on update",
  "PersistenceTest > find raises record not found exception": "ActiveRecord > Base > finders > find raises record not found exception",
  "PersistenceTest > save with duping of destroyed object": "ActiveRecord > Base (extended) > save destroyed object",
  "PersistenceTest > update column": "ActiveRecord > updateColumn / updateColumns > update column",
  "PersistenceTest > update columns": "ActiveRecord > updateColumn / updateColumns > update columns",
  "PersistenceTest > update column should not use setter method": "update_column / update_columns (Rails-guided) > update column should not use setter method",
  "PersistenceTest > update column should raise exception if new record": "update_column / update_columns (Rails-guided) > update columns should raise exception if new record",
  "PersistenceTest > update column should not leave the object dirty": "update_column / update_columns (Rails-guided) > update column should not leave the object dirty",
  "PersistenceTest > update columns should not use setter method": "update_column / update_columns (Rails-guided) > update column should not use setter method",
  "PersistenceTest > update columns should raise exception if new record": "update_column / update_columns (Rails-guided) > update columns should raise exception if new record",
  "PersistenceTest > update columns should not leave the object dirty": "update_column / update_columns (Rails-guided) > update column should not leave the object dirty",
  "PersistenceTest > update column should not modify updated at": "ActiveRecord > Bulk operations edge cases > update column should not modify updated at",
  "PersistenceTest > update column with model having primary key other than id": "ActiveRecord > updateColumn / updateColumns > update column",
  "PersistenceTest > update columns with model having primary key other than id": "ActiveRecord > updateColumn / updateColumns > update columns",
  "PersistenceTest > reload removes custom selects": "ActiveRecord > Persistence edge cases > reload clears dirty tracking",
  "PersistenceTest > destroyed returns boolean": "Persistence (Rails-guided) > destroy marks record as destroyed and not persisted",
  // --- finder_test.rb ---
  "FinderTest > find": "ActiveRecord > Finders (Rails-guided) > find by primary key",
  "FinderTest > sole": "ActiveRecord > sole() and take() > sole() returns the only matching record",
  "FinderTest > sole failing none": "ActiveRecord > sole() and take() > sole() raises RecordNotFound when zero records",
  "FinderTest > sole failing many": "ActiveRecord > sole() and take() > sole() raises SoleRecordExceeded when multiple records",
  "FinderTest > find by sql with sti on joined table": "ActiveRecord > findBySql > returns model instances from raw SQL",
  "FinderTest > second": "ActiveRecord > positional finders > second() returns the second record",
  "FinderTest > third": "ActiveRecord > positional finders > third() returns the third record",
  "FinderTest > fourth": "ActiveRecord > positional finders > fourth() and fifth() return correct records",
  "FinderTest > take": "ActiveRecord > sole() and take() > take() returns a record without ordering",
  "FinderTest > take and first and last with integer should return an array": "ActiveRecord > sole() and take() > take(n) returns n records",
  "FinderTest > take bang missing": "ActiveRecord > sole() and take() > takeBang() raises when no records",
  "FinderTest > first": "ActiveRecord > Relation > first returns the first record",
  "FinderTest > first have primary key order by default": "ActiveRecord > Relation > first returns the first record",
  "FinderTest > first bang missing": "ActiveRecord > Relation (extended) > firstBang returns first or throws",
  "FinderTest > last bang missing": "ActiveRecord > Relation (extended) > lastBang returns last or throws",
  "FinderTest > last on relation with limit and offset": "ActiveRecord > Relation (extended) > last returns the last record by PK",
  "FinderTest > exists": "ActiveRecord > Relation > exists returns true when records exist",
  "FinderTest > exists returns false with false arg": "Relation (Rails-guided) > exists on none returns false",
  "FinderTest > exists with scope": "ActiveRecord > Base.exists > checks by conditions hash",
  "FinderTest > exists with string": "ActiveRecord > Base.exists > checks by primary key",
  "FinderTest > find by one attribute": "ActiveRecord > Base.findByAttribute > finds a record by a single attribute",
  "FinderTest > find by one attribute bang": "ActiveRecord > Base.findByAttribute > returns null when not found",
  "FinderTest > second to last": "ActiveRecord > positional finders > secondToLast() returns the second-to-last record",
  "FinderTest > third to last": "ActiveRecord > positional finders > thirdToLast() returns the third-to-last record",
  "FinderTest > find with ids with no id passed": "ActiveRecord > Finders (Rails-guided) > find with empty array returns empty",
  "FinderTest > find by ids": "ActiveRecord > Finders (Rails-guided) > find with multiple IDs",
  "FinderTest > find by id with hash": "ActiveRecord > Finders (Rails-guided) > find by primary key",
  "FinderTest > find with custom select excluding id": "ActiveRecord > Finders (Rails-guided) > find by primary key",
  "FinderTest > find with ids and order clause": "ActiveRecord > Finders (Rails-guided) > find with multiple IDs",
  "FinderTest > find passing active record object is not permitted": "ActiveRecord > Finders (Rails-guided) > find raises RecordNotFound for missing ID",
  "FinderTest > exists returns true with one record and no args": "ActiveRecord > Finders (Rails-guided) > exists returns true for matching records",
  "FinderTest > count by sql": "ActiveRecord > Relation > count returns the number of records",
  // --- calculations_test.rb ---
  "CalculationsTest > should group by field": "ActiveRecord > grouped calculations > group().count() returns hash of counts",
  "CalculationsTest > should group by summed field": "ActiveRecord > grouped calculations > group().sum() returns hash of sums",
  "CalculationsTest > should group by summed field having condition": "ActiveRecord > grouped calculations > group().sum() returns hash of sums",
  "CalculationsTest > should group by arel attribute": "ActiveRecord > grouped calculations > group().count() returns hash of counts",
  "CalculationsTest > pluck": "Relation (Rails-guided) > pluck with multiple columns returns array of arrays",
  "CalculationsTest > ids": "ActiveRecord > Relation > ids returns primary key values",
  "CalculationsTest > ids on relation": "ActiveRecord > Relation edge cases > ids with where returns filtered IDs",
  "CalculationsTest > ids with scope": "ActiveRecord > Relation edge cases > ids with where returns filtered IDs",
  "CalculationsTest > count with distinct": "ActiveRecord > distinct count > count with distinct uses COUNT(DISTINCT ...)",
  "CalculationsTest > apply distinct in count": "ActiveRecord > distinct count > count with distinct uses COUNT(DISTINCT ...)",
  "CalculationsTest > distinct count all with custom select and order": "ActiveRecord > distinct count > count with distinct uses COUNT(DISTINCT ...)",
  "CalculationsTest > should return decimal average of integer field": "Calculations (Rails-guided) > average on empty table returns null",
  "CalculationsTest > pick one": "ActiveRecord > Relation: pick, first(n), last(n) > pick returns first row's columns",
  "CalculationsTest > pick two": "ActiveRecord > Relation: pick, first(n), last(n) > pick returns null when no records",
  "CalculationsTest > should sum scoped field with from": "ActiveRecord > Aggregation edge cases > should sum scoped field with conditions",
  "CalculationsTest > count should shortcut with limit zero": "ActiveRecord > Relation > count returns the number of records",
  "CalculationsTest > limit should apply before count": "ActiveRecord > Relation > count returns the number of records",
  "CalculationsTest > count with reverse order": "ActiveRecord > Relation > count returns the number of records",
  "CalculationsTest > no queries for empty relation on average": "ActiveRecord > Aggregation edge cases > no queries for empty relation on minimum",
  // --- relations_test.rb ---
  "RelationTest > scoped": "ActiveRecord > Relation > all returns all records",
  "RelationTest > scoped all": "ActiveRecord > Relation > all returns all records",
  "RelationTest > count complex chained relations": "ActiveRecord > Relation > count with where",
  "RelationTest > empty complex chained relations": "ActiveRecord > Relation edge cases > count on empty table returns 0",
  "RelationTest > loaded first": "ActiveRecord > Relation > first returns the first record",
  "RelationTest > scoped first": "ActiveRecord > Relation > first returns the first record",
  "RelationTest > loaded all": "ActiveRecord > Relation > all returns all records",
  "RelationTest > size": "ActiveRecord > Relation state: isLoaded, reset, size, isEmpty, isAny, isMany > size returns count without loading",
  "RelationTest > empty": "ActiveRecord > Relation state: isLoaded, reset, size, isEmpty, isAny, isMany > isEmpty returns true when no records",
  "RelationTest > any": "ActiveRecord > Relation state: isLoaded, reset, size, isEmpty, isAny, isMany > isAny returns true when records exist",
  "RelationTest > many": "ActiveRecord > Relation state: isLoaded, reset, size, isEmpty, isAny, isMany > isMany returns true when more than one record",
  "RelationTest > finding with group": "ActiveRecord > Relation (extended) > group generates GROUP BY SQL",
  "RelationTest > select with block": "ActiveRecord > select block form > filters loaded records with a function",
  "RelationTest > none?": "ActiveRecord > Relation (extended) > none().exists() returns false",
  "RelationTest > to sql on scoped proxy": "ActiveRecord > Relation > toSql generates SQL",
  "RelationTest > to sql on eager join": "ActiveRecord > Relation > toSql generates SQL",
  "RelationTest > finding with order": "ActiveRecord > Relation > order sorts results",
  "RelationTest > reverse order with function": "ActiveRecord > Relation (extended) > reverseOrder reverses asc to desc",
  "RelationTest > having with binds for both where and having": "ActiveRecord > Relation#having > generates SQL with HAVING clause",
  "RelationTest > multiple where and having clauses": "ActiveRecord > Relation#having > generates SQL with HAVING clause",
  "RelationTest > loaded relations cannot be mutated by extending!": "ActiveRecord > extending() > adds custom methods to a relation",
  "RelationTest > select quotes when using from clause": "ActiveRecord > from() > changes the FROM clause in SQL",
  "RelationTest > relation with annotation includes comment in to sql": "ActiveRecord > annotate() > adds SQL comments to the query",
  "RelationTest > relation with annotation includes comment in count query": "ActiveRecord > annotate() > supports multiple annotations",
  "RelationTest > multivalue where": "ActiveRecord > Relation > where is chainable",
  "RelationTest > find ids": "ActiveRecord > Relation > ids returns primary key values",
  "RelationTest > finding with reorder": "ActiveRecord > Relation (extended) > reorder replaces existing order",
  "RelationTest > destroy by": "ActiveRecord > destroyBy and deleteBy > destroyBy destroys matching records with callbacks",
  "RelationTest > delete by": "ActiveRecord > destroyBy and deleteBy > deleteBy deletes matching records without callbacks",
  "RelationTest > pluck with from includes original table name": "ActiveRecord > Relation edge cases > pluck on empty table returns empty array",
  "RelationTest > scope for create": "ActiveRecord > scopeForCreate / whereValuesHash > scopeForCreate returns attributes for new records",
  "RelationTest > empty where values hash": "ActiveRecord > scopeForCreate / whereValuesHash > whereValuesHash returns the where conditions",
  "RelationTest > create with value": "ActiveRecord > createWith() > applies default attrs when creating via findOrCreateBy",
  "RelationTest > update all goes through normal type casting": "ActiveRecord > Relation > update all",
  "RelationTest > no queries on empty relation exists?": "ActiveRecord > Relation > exists returns false when no records match",
  "RelationTest > no queries on empty condition exists?": "ActiveRecord > Base.exists > returns true when records exist (no args)",
  "RelationTest > find or create by": "find_or_create_by (Rails-guided) > find_or_create_by finds existing",
  "RelationTest > find or create by with create with": "find_or_create_by (Rails-guided) > find_or_create_by is idempotent",
  "RelationTest > find or initialize by": "ActiveRecord > find_or_create_by / find_or_initialize_by > findOrInitializeBy returns existing record if found",
  "RelationTest > find or initialize by with block": "ActiveRecord > find_or_create_by / find_or_initialize_by > findOrInitializeBy returns unsaved record if not found",
  "RelationTest > finding with desc order with string": "ActiveRecord > findEach with order > supports order: desc option",
  "RelationTest > last": "ActiveRecord > Relation (extended) > last returns the last record by PK",
  // --- relation_test.rb ---
  "RelationTest > responds to model and returns klass": "ActiveRecord > Relation value accessors > limitValue returns the limit",
  // --- callbacks_test.rb ---
  "CallbacksTest > create": "Callbacks (Rails-guided) > create lifecycle: before_validation \u2192 after_validation \u2192 before_save \u2192 before_create \u2192 after_create \u2192 after_save",
  "CallbacksTest > initialize": "ActiveRecord > after_initialize / after_find callbacks > fires after_initialize on new records",
  "CallbacksTest > find": "ActiveRecord > after_initialize / after_find callbacks > fires after_find when loading from database",
  "CallbacksTest > new valid?": "Callbacks (Rails-guided) > before_validation callbacks run exactly once",
  "CallbacksTest > validate on create": "Callbacks (Rails-guided) > create lifecycle: before_validation \u2192 after_validation \u2192 before_save \u2192 before_create \u2192 after_create \u2192 after_save",
  "CallbacksTest > validate on update": "Callbacks (Rails-guided) > update lifecycle: before_validation \u2192 after_validation \u2192 before_save \u2192 before_update \u2192 after_update \u2192 after_save",
  // --- dirty_test.rb ---
  "DirtyTest > attribute changes": "ActiveRecord > dirty tracking: attributeInDatabase, attributeBeforeLastSave > changedAttributeNamesToSave returns pending changes",
  "DirtyTest > saved_changes returns a hash of all the changes that occurred": "ActiveRecord > savedChanges > tracks changes from the last save",
  "DirtyTest > object should be changed if any attribute is changed": "ActiveRecord > Dirty (Rails-guided) > object should be changed if any attribute is changed",
  "DirtyTest > reverted changes are not dirty after multiple changes": "ActiveRecord > Dirty (Rails-guided) > reverted changes are not dirty",
  "DirtyTest > reverted changes are not dirty": "ActiveRecord > Dirty (Rails-guided) > reverted changes are not dirty",
  "DirtyTest > changed attributes should be preserved if save failure": "ActiveRecord > Dirty (Rails-guided) > changed attributes should be preserved if save failure",
  "DirtyTest > reload should clear changed attributes": "ActiveRecord > Dirty (Rails-guided) > reload should clear changed attributes",
  // --- enum_test.rb ---
  "EnumTest > query state by predicate with prefix": "ActiveRecord > enum prefix/suffix > prefix: true uses attribute name as prefix",
  "EnumTest > query state by predicate with custom suffix": "ActiveRecord > enum prefix/suffix > prefix: string uses custom prefix",
  "EnumTest > declare multiple enums with prefix: true": "ActiveRecord > enum enhancements > generates not-scopes",
  // --- excluding_test.rb ---
  "ExcludingTest > result set does not include single excluded record": "ActiveRecord > excluding() / without() > excludes specific records by PK",
  "ExcludingTest > does not exclude records when no arguments": "ActiveRecord > excluding() / without() > without() is an alias for excluding()",
  // --- null_relation_test.rb ---
  "NullRelationTest > none chainable": "ActiveRecord > Relation edge cases > none chained with where still returns empty",
  "NullRelationTest > null relation content size methods": "ActiveRecord > Relation (extended) > none().first() returns null",
  "NullRelationTest > null relation where values hash": "ActiveRecord > scopeForCreate / whereValuesHash > whereValuesHash returns the where conditions",
  // --- cache_key_test.rb ---
  "CacheKeyTest > cache_key format is not too precise": "ActiveRecord > cacheKey / cacheKeyWithVersion > returns model/id for persisted records",
  "CacheKeyTest > cache_key_with_version always has both key and version": "ActiveRecord > cacheKey / cacheKeyWithVersion > returns model/new for new records",
  // --- sanitize_test.rb ---
  "SanitizeTest > sanitize sql array handles named bind variables": "ActiveRecord > sanitizeSql > sanitizeSqlArray replaces ? placeholders with quoted values",
  "SanitizeTest > named bind variables": "ActiveRecord > where with named binds > replaces :name placeholders with values",
  "SanitizeTest > bind range": "ActiveRecord > where with Range > generates BETWEEN SQL",
  // --- clone_test.rb ---
  "CloneTest > persisted": "ActiveRecord > Base#clone > creates a shallow clone preserving id and persisted state",
  "CloneTest > shallow": "ActiveRecord > Base#clone > clone is independent from original",
  // --- core_test.rb ---
  "CoreTest > inspect instance": "ActiveRecord > inspect() > returns a human-readable string",
  "CoreTest > inspect new instance": "ActiveRecord > inspect() > returns a human-readable string",
  // --- readonly_test.rb ---
  "ReadOnlyTest > cant update column readonly record": "ActiveRecord > readonly > prevents destroying a readonly record",
  // --- relation/or_test.rb ---
  "OrTest > or with relation": "ActiveRecord > Relation#or > combines two where clauses with OR",
  "OrTest > or with null left": "ActiveRecord > Relation#or edge cases > triple or chains",
  // --- relation/delete_all_test.rb ---
  "DeleteAllTest > delete all": "ActiveRecord > Relation (extended) > deleteAll returns the number of deleted rows",
  // --- relation/update_all_test.rb ---
  "UpdateAllTest > update all with scope": "ActiveRecord > Relation > update all",
  "UpdateAllTest > update all doesnt ignore order": "ActiveRecord > Bulk operations edge cases > updateAll does not run callbacks",
  // --- relation/select_test.rb ---
  "SelectTest > select with block without any arguments": "ActiveRecord > select block form > filters loaded records with a function",
  "SelectTest > non select columns wont be loaded": "ActiveRecord > Relation (extended) > select returns records with projected columns in SQL",
  "SelectTest > select with hash with not exists field": "ActiveRecord > Finders (Rails-guided) > exists with conditions hash",
  // --- relation/mutation_test.rb ---
  "RelationMutationTest > extending!": "ActiveRecord > extending() > adds custom methods to a relation",
  // --- relation/merging_test.rb ---
  "RelationMergingTest > relation merging with locks": "ActiveRecord > merge() > combines conditions from two relations",
  // --- relation/structural_compatibility_test.rb ---
  // StructuralCompatibilityTest entries removed - Ruby names don't match report
  // --- relation/field_ordered_values_test.rb ---
  "FieldOrderedValuesTest > in order of": "ActiveRecord > inOrderOf() > generates CASE WHEN ordering SQL",
  // --- relation/where_chain_test.rb ---
  "WhereChainTest > not with nil": "ActiveRecord > Relation (extended) > whereNot with null uses IS NOT NULL",
  "WhereChainTest > not inverts where clause": "ActiveRecord > Relation (extended) > whereNot excludes matching records",
  "WhereChainTest > not eq with preceding where": "ActiveRecord > Relation edge cases > whereNot with array generates NOT IN",
  "WhereChainTest > associated with association": "ActiveRecord > whereAssociated / whereMissing > whereAssociated filters records WITH non-null FK",
  "WhereChainTest > missing with association": "ActiveRecord > whereAssociated / whereMissing > whereMissing filters records WITH null FK",
  // --- relation/where_test.rb ---
  // WhereTest > where with Range removed - Ruby name doesn't match report
  // --- scoping/default_scoping_test.rb ---
  "DefaultScopingTest > default scope with all queries doesnt run on destroy when unscoped": "ActiveRecord > default_scope / unscoped > unscoped then where applies user conditions only",
  "DefaultScopingTest > default scope": "default_scope / unscoped (Rails-guided) > default_scope filters all queries",
  "DefaultScopingTest > default scope with inheritance": "default_scope / unscoped (Rails-guided) > default_scope applies to where chains",
  "DefaultScopingTest > default scope runs on select": "ActiveRecord > default_scope / unscoped > default_scope is applied to all queries",
  "DefaultScopingTest > default scope with all queries runs on select": "ActiveRecord > Scopes (Rails-guided) > default_scope is applied to all queries",
  "DefaultScopingTest > default scope with all queries runs on reload but default scope without all queries does not": "ActiveRecord > Scopes (Rails-guided) > default_scope is applied to all queries",
  "DefaultScopingTest > unscoped with named scope should not have default scope": "Scopes edge cases (Rails-guided) > default_scope combined with named scope",
  "DefaultScopingTest > default scope include with count": "Scopes (Rails-guided) > scope with count",
  // --- scoping/named_scoping_test.rb ---
  "NamedScopingTest > procedural scopes": "ActiveRecord > Scopes > defines and uses a named scope",
  "NamedScopingTest > scopes with string name can be composed": "ActiveRecord > Scope proxy > scopes chain together",
  "NamedScopingTest > positional scope method": "ActiveRecord > Scope proxy > scope with arguments",
  "NamedScopingTest > delegates finds and calculations to the base class": "ActiveRecord > Base class aggregate delegates > count returns total records",
  "NamedScopingTest > scope should respond to own methods and methods of the proxy": "ActiveRecord > Scope proxy > scope is accessible on Relation via proxy",
  "NamedScopingTest > scope with kwargs": "ActiveRecord > Scope proxy > scope with arguments",
  // --- transactions_test.rb ---
  "TransactionTest > successful": "Transactions (Rails-guided) > successful",
  "TransactionTest > failing on exception": "Transactions (Rails-guided) > failing on exception",
  // Transaction override entries removed - Ruby names don't match report
  // --- locking_test.rb ---
  "OptimisticLockingTest > lock new": "Optimistic Locking (Rails-guided) > lock existing",
  "OptimisticLockingTest > lock repeating": "Optimistic Locking (Rails-guided) > lock exception record",
  // --- counter_cache_test.rb ---
  "CounterCacheTest > decrement counter": "ActiveRecord > incrementCounter / decrementCounter > decrements a counter column by primary key",
  "CounterCacheTest > increment counter": "ActiveRecord > incrementCounter / decrementCounter > increments a counter column by primary key",
  // --- store_test.rb ---
  "StoreTest > reading store attributes through accessors": "ActiveRecord > Store > reads from pre-existing JSON data",
  "StoreTest > updating the store will mark it as changed": "ActiveRecord > Store > persists through save and reload",
  // --- strict_loading_test.rb ---
  "StrictLoadingTest > strict loading": "ActiveRecord > strict_loading > raises StrictLoadingViolationError on lazy association load",
  "StrictLoadingTest > strict loading by default": "ActiveRecord > strictLoadingByDefault > defaults to false",
  "StrictLoadingTest > strict loading by default is inheritable": "ActiveRecord > strictLoadingByDefault > sets strict loading on instantiated records when enabled",
  // --- inheritance_test.rb ---
  "InheritanceTest > compute type success": "ActiveRecord > STI > subclasses share the parent table",
  "InheritanceTest > compute type nonexistent constant": "STI (Rails-guided) > inheritance condition",
  // --- insert_all_test.rb ---
  "InsertAllTest > insert all": "ActiveRecord > insertAll / upsertAll > returns 0 for empty array",
  // --- reflection_test.rb ---
  "ReflectionTest > columns are returned in the order they were declared": "ActiveRecord > reflection > returns columns for a model",
  "ReflectionTest > content columns": "ActiveRecord > reflection > returns column names for a model",
  // --- validations_test.rb ---
  "ValidationsTest > save without validation": "ActiveRecord > Base > validations > validates before saving",
  // --- attribute_methods_test.rb ---
  "AttributeMethodsTest > respond_to?": "ActiveRecord > hasAttribute() > returns true for defined attributes",
  "AttributeMethodsTest > attribute_present": "ActiveRecord > attributePresent() > returns true for non-null, non-empty values",
  "AttributeMethodsTest > attribute_for_inspect with a string": "ActiveRecord > attributeForInspect > formats string attributes with quotes",
  "AttributeMethodsTest > attribute_names on a new record": "ActiveRecord > attributeNames() > returns list of defined attribute names",
  // --- attributes_test.rb ---
  // AttributesTest entries removed - Ruby names don't match report
  // --- batches_test.rb ---
  "EachTest > each should not return query chain and execute only one query": "ActiveRecord > findEach / findInBatches > findEach yields each record",
  "EachTest > each should execute one query per batch": "ActiveRecord > findEach / findInBatches > findEach yields individual records",
  "EachTest > in batches should yield relation if block given": "ActiveRecord > inBatches > yields Relation objects for each batch",
  "EachTest > find in batches should start from the start option": "ActiveRecord > findEach with start/finish > finds records within a range",
  "EachTest > in batches touch all affect all records": "find_each / find_in_batches (Rails-guided) > find_each yields all records",
  // --- dup_test.rb ---
  "DupTest > dup": "ActiveRecord > dup() > creates an unsaved copy without primary key",
  "DupTest > dup not persisted": "ActiveRecord > dup() > creates an unsaved copy without primary key",
  // --- signed_id_test.rb ---
  "SignedIdTest > find signed record": "ActiveRecord > signedId / findSigned / findSignedBang > generates a signed ID for a persisted record",
  // --- timestamp_test.rb ---
  // TimestampTest "updates timestamps" / "sets timestamps" entries removed - Ruby names don't match
  "TimestampTest > touching a record updates its timestamp": "ActiveRecord > touch > touching a record updates its timestamp",
  "TimestampTest > touching an attribute updates it": "ActiveRecord > touch > touching an attribute updates it",
  "TimestampTest > saving a unchanged record doesnt update its timestamp": "Persistence edge cases (Rails-guided) > saving a unchanged record doesnt update its timestamp",
  // --- normalized_attribute_test.rb ---
  "NormalizedAttributeTest > normalizes value from create": "ActiveRecord > normalizes on Base > normalizes attributes before persistence",
  // --- finder_respond_to_test.rb ---
  "FinderRespondToTest > should respond to find by one attribute before caching": "ActiveRecord > Base.respondToMissingFinder > returns true for valid dynamic finders",
  // --- token_for_test.rb ---
  "TokenForTest > finds record by token": "ActiveRecord > generatesTokenFor() > generates and resolves a token",
  // --- cross-file fuzzy matches (verified) ---
  "PersistenceTest > find raises record not found exception": "Finders edge cases (Rails-guided) > find raises record not found exception",
  "PersistenceTest > save with duping of destroyed object": "Persistence edge cases (Rails-guided) > destroy marks record as destroyed",
  "PersistenceTest > destroy for a failed to destroy cpk record": "ActiveRecord > static destroy(id) > destroys a single record by id",
  "TimestampTest > touching an attribute updates timestamp": "ActiveRecord > touch > touching an attribute updates it",
  "TimestampTest > saving an unchanged record with a non mutating before update callback does not update its timestamp": "ActiveRecord > Persistence edge cases > update does not run sql if record has not changed",
  "TimestampTest > touching a record touches parent record and grandparent record": "ActiveRecord > touch > touching a record updates its timestamp",
  "FinderTest > exists returns false with false arg": "Relation (Rails-guided) > exists on none returns false",
  "FinderTest > last with integer and order should keep the order": "Relation (Rails-guided) > last with ordering returns the last in that order",
  "FinderTest > take and first and last with integer should return an array": "ActiveRecord > CollectionProxy enhancements > first and last return correct records",
  "FinderTest > find with ids with limit and order clause": "ActiveRecord > Base (extended) > find with missing IDs throws",
  "CalculationsTest > should count with manual distinct select and distinct": "ActiveRecord > distinct count > count with distinct uses COUNT(DISTINCT ...)",
  "CalculationsTest > distinct count with order and limit and offset": "ActiveRecord > Unscope (Rails-guided) > removes limit and offset",
  "DefaultScopingTest > scope composed by limit and then offset is equal to scope composed by offset and then limit": "ActiveRecord > unscope() > removes limit and offset",
  "RelationTest > find all using where with relation with select to build subquery": "ActiveRecord > where with subquery > supports Relation as value for IN subquery",
  "RelationTest > find all using where with relation with no selects and composite primary key raises": "Error Classes (Rails-guided) > find raises RecordNotFound with model, primary_key, and id",
  "RelationScopingTest > scoped create with where with array": "Relation (Rails-guided) > where with array produces IN",
  "RelationScopingTest > scoped create with where with range": "ActiveRecord > where with Range > generates BETWEEN SQL",
  "RelationScopingTest > scoped create with create with has higher priority": "ActiveRecord > Relation spawn/build/create > create persists a record with scoped attributes",
  "ActiveRecord::Relation > WhereClauseTest > or returns an empty where clause when either side is empty": "ActiveRecord > Relation Where (Rails-guided) > where with empty array returns no results",
  "ActiveRecord::Relation > WhereClauseTest > merge combines two where clauses": "ActiveRecord > Relation Merging (Rails-guided) > merge combines two relations",
  "ActiveRecord::Relation > WhereClauseTest > + combines two where clauses": "ActiveRecord > Relation: set operations > union combines two relations",
  "HasAndBelongsToManyAssociationsTest > destroy associations destroys multiple associations": "ActiveRecord > Associations: dependent > dependent destroy destroys children",
  "HasManyAssociationsTest > delete all with option delete all": "Bulk operations (Rails-guided) > delete all",
  "LeftOuterJoinAssociationTest > left outer joins actually does a left outer join": "Rails-guided: New Features > leftJoins generates LEFT OUTER JOIN SQL",
  "BelongsToAssociationsTest > polymorphic with custom name counter cache": "ActiveRecord > counter_cache > supports custom counter column name",
  "EachTest > in batches delete all should not delete records in other batches": "ActiveRecord > Persistence (Rails-guided) > delete all removes all records",
  "EachTest > in batches destroy all should not destroy records in other batches": "Batches (Rails-guided) > findEach processes all records",
  "TransactionTest > nested transactions after disable lazy transactions": "ActiveRecord > Transactions (Rails-guided) > nested savepoint",
  "TransactionCallbacksTest > save in after create commit wont invoke extra after create commit": "Callbacks (Rails-guided) > after_save runs on both create and update",
  "PrimaryKeysTest > quoted primary key after set primary key": "ActiveRecord > Base.exists > checks by primary key",
  "PrimaryKeysTest > primary key update with custom key name": "ActiveRecord > Base features (Rails-guided) > custom primary key",
  "PrimaryKeysTest > find with multiple ids should quote pkey": "ActiveRecord > Finders (Rails-guided) > find with multiple IDs",
  "PrimaryKeysTest > reconfiguring primary key resets composite primary key": "ActiveRecord > Finders (Rails-guided) > find by primary key",
  "CallbackOrderTest > callbacks run in order defined in model if not using run after transaction callbacks in order defined": "Callbacks (Rails-guided) > multiple callbacks of same type run in order",
  "UniquenessValidationTest > validate uniqueness with conditions with record arg": "Rails-guided: New Features > validate uniqueness with scope",
  "TokenForTest > returns nil when record is not found": "ActiveRecord > firstOrCreate / firstOrInitialize > firstOrInitialize returns unsaved record when not found",
  "AttributeMethodsTest > #alias_attribute with an overridden original method along with an overridden alias method uses the overridden alias method": "alias_attribute (Rails-guided) > alias works with integer attributes",
  "SanitizeTest > disallow raw sql with unknown attribute sql literal": "Raw SQL Where (Rails-guided) > where with LIKE query",
  "ReflectionTest > active record primary key raises when missing primary key": "ActiveRecord > Base > primary key > can be overridden",
  "CalculationsTest > should count manual with count all": "ActiveRecord > Relation Or (Rails-guided) > or with count",
  "RelationTest > find all using where with relation with joins": "Relation (Rails-guided) > where with null produces IS NULL",
  "CalculationsTest > count with distinct": "ActiveRecord > distinct count > count with distinct uses COUNT(DISTINCT ...)",
  "HasManyThroughAssociationsTest > has many association through a has many association to self": "ActiveRecord > association scopes > applies scope to has_many association",
  "NestedThroughAssociationsTest > has many through has many with has many through source reflection": "ActiveRecord > has_and_belongs_to_many > loads associated records through a join table",

  // ==========================================================================
  // ActiveRecord overrides — batch 2 (automated fuzzy matches)
  // ==========================================================================

  // --- relations_test.rb ---
  "RelationTest > finding with order and take": "RelationTest > finding with order and take",
  "RelationTest > respond to dynamic finders": "RelationTest > respond to dynamic finders",
  "RelationTest > find all using where with relation does not alter select values": "RelationTest > find all using where with relation does not alter select values",
  "RelationTest > first or initialize with no parameters": "RelationTest > first or initialize with no parameters",
  "RelationTest > create or find by with block": "RelationTest > create or find by with block",
  "RelationTest > find_by with multi-arg conditions returns the first matching record": "FinderTest > find_by with multi-arg conditions returns the first matching record",
  "RelationTest > find_by! with hash conditions returns the first matching record": "ActiveRecord > Base > finders > find_by with hash conditions returns the first matching record",
  "RelationTest > find_by! with non-hash conditions returns the first matching record": "ActiveRecord > Base > finders > find_by with hash conditions returns the first matching record",
  "RelationTest > find_by! with multi-arg conditions returns the first matching record": "FinderTest > find_by with multi-arg conditions returns the first matching record",
  "RelationTest > find_by! doesn't have implicit ordering": "RelationTest > find_by doesn't have implicit ordering",
  "RelationTest > find_by! requires at least one argument": "RelationTest > find_by! requires at least one argument",
  "RelationTest > loaded relations cannot be mutated by extending!": "RelationTest > loaded relations cannot be mutated by extending!",
  "RelationTest > finding with subquery with binds": "RelationTest > finding with subquery",
  "RelationTest > pluck with from includes quoted original table name": "RelationTest > select with from includes quoted original table name",
  "RelationTest > finding with complex order": "RelationTest > finding with order",
  "RelationTest > finding with sanitized order": "RelationTest > finding with order",
  "RelationTest > find all using where with relation with bound values": "RelationTest > find all using where with relation",
  "RelationTest > create or find by with bang": "RelationTest > find or create by with create with",
  "RelationTest > loaded relations cannot be mutated by merge!": "RelationTest > loaded relations cannot be mutated by extending!",
  "RelationTest > reverse arel assoc order with function": "RelationTest > reverse order with function",
  "RelationTest > reverse order with function other predicates": "RelationTest > reverse order with function",
  "RelationTest > loading with one association with non preload": "RelationTest > loading with one association",
  "RelationTest > where id with delegated ar object": "RelationTest > where with ar object",
  "RelationTest > create or find by within transaction": "RelationTest > find or create by",

  // --- finder_test.rb ---
  "FinderTest > exists with loaded relation": "FinderTest > exists with loaded relation",
  "FinderTest > find by ids with limit and offset": "FinderTest > find by ids with limit and offset",
  "FinderTest > model class responds to last bang": "FinderTest > model class responds to last bang",
  "FinderTest > first on relation with limit and offset": "FinderTest > first on relation with limit and offset",
  "FinderTest > last on relation with limit and offset": "FinderTest > last on relation with limit and offset",
  "FinderTest > hash condition find with escaped characters": "FinderTest > hash condition find with escaped characters",
  "FinderTest > hash condition find with array": "FinderTest > hash condition find with array",
  "FinderTest > hash condition find with nil": "FinderTest > hash condition find with nil",
  "FinderTest > named bind variables": "FinderTest > named bind variables",
  "FinderTest > find by two attributes": "FinderTest > find by two attributes",
  "FinderTest > find by two attributes but passing only one": "FinderTest > find by two attributes but passing only one",
  "FinderTest > find by empty ids": "FinderTest > find by empty ids",
  "FinderTest > find_by! with non-hash conditions returns the first matching record": "ActiveRecord > Base > finders > find_by with hash conditions returns the first matching record",
  "FinderTest > find_by! with multi-arg conditions returns the first matching record": "FinderTest > find_by with multi-arg conditions returns the first matching record",
  "FinderTest > exists with distinct and offset and eagerload and order": "FinderTest > exists with order and distinct",
  "FinderTest > #find_by with composite primary key": "ActiveRecord > Base > finders > find by primary key",

  // --- calculations_test.rb ---
  "CalculationsTest > should calculate grouped with longer field": "CalculationsTest > should calculate grouped with longer field",
  "CalculationsTest > count with block": "RelationTest > count with block",
  "CalculationsTest > count with reverse order": "CalculationsTest > count with reverse order",
  "CalculationsTest > should group by multiple fields having functions": "CalculationsTest > should group by multiple fields",
  "CalculationsTest > should group by summed association": "CalculationsTest > should group by summed field",
  "CalculationsTest > count with order": "CalculationsTest > count with reverse order",
  "CalculationsTest > ids on loaded relation": "CalculationsTest > ids on relation",
  "CalculationsTest > ids with contradicting scope": "CalculationsTest > ids with scope",

  // --- base_test.rb ---
  "BasicsTest > no limit offset": "CalculationsTest > no limit no offset",

  // --- persistence_test.rb ---
  "PersistenceTest > class level update is affected by scoping!": "PersistenceTest > class level update is affected by scoping",
  "PersistenceTest > update attribute!": "ActiveRecord > Persistence (Rails-guided) > update attribute",
  "PersistenceTest > update columns should not modify updated at": "ActiveRecord > Bulk operations edge cases > update column should not modify updated at",
  "PersistenceTest > class level destroy is affected by scoping": "PersistenceTest > class level update is affected by scoping",
  "PersistenceTest > class level delete is affected by scoping": "PersistenceTest > class level update is affected by scoping",
  "PersistenceTest > update for record with only primary key": "PersistenceTest > save for record with only primary key",
  "PersistenceTest > destroy raises record not found exception": "ActiveRecord > Base > finders > find raises record not found exception",
  "PersistenceTest > update attribute for updated at on": "Persistence edge cases (Rails-guided) > updated_at changes on attribute update",
  "PersistenceTest > update attribute for updated at on!": "Persistence edge cases (Rails-guided) > updated_at changes on attribute update",
  "PersistenceTest > increment aliased attribute": "ActiveRecord > Base: increment/decrement/toggle > increment attribute",

  // --- batches_test.rb ---
  "EachTest > each should return a sized enumerator": "EachTest > each should return a sized enumerator",
  "EachTest > in batches should end at the finish option": "EachTest > find in batches should end at the finish option",
  "EachTest > in batches should use any column as primary key": "EachTest > find in batches should use any column as primary key",
  "EachTest > find in batches should use any column as primary key when start is not specified": "EachTest > find in batches should use any column as primary key",
  "EachTest > in batches should use any column as primary key when start is not specified": "EachTest > find in batches should use any column as primary key",
  "EachTest > in batches should return relations": "ActiveRecord > findEach / findInBatches > find in batches should return batches",

  // --- enum_test.rb ---
  "EnumTest > validate uniqueness": "ActiveRecord > UniquenessValidator > validate uniqueness",
  "EnumTest > reverted changes that are not dirty": "ActiveRecord > Dirty (Rails-guided) > reverted changes are not dirty",
  "EnumTest > query state by predicate with :prefix": "ActiveRecord > Enum > query state by predicate",
  "EnumTest > query state by predicate with :suffix": "ActiveRecord > Enum > query state by predicate",

  // --- relation/or_test.rb ---
  "OrTest > or with sti relation": "ActiveRecord > Relation Or (Rails-guided) > or with relation",

  // --- scoping/default_scoping_test.rb ---
  "DefaultScopingTest > unscope reverse order": "OrderTest > reverse order",
};
