# Phase 1000: ActiveModel Attributes and Type Casting

## Goal

Implement the attribute definition and type casting system that underlies
ActiveModel and ActiveRecord.

## Scope

- `ActiveModel::Attributes` — `attribute` class method for declaring typed attrs
- `ActiveModel::Type` registry — `:string`, `:integer`, `:float`, `:boolean`,
  `:date`, `:datetime`, `:decimal`
- Type casting and deserialization
- Default values (static and lambda)
- `attributes`, `attribute_names`, `attribute_present?`

## Rails Reference

- https://api.rubyonrails.org/classes/ActiveModel/Attributes.html
- https://api.rubyonrails.org/classes/ActiveModel/Type.html
