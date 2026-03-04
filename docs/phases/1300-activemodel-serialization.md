# Phase 1300: ActiveModel Serialization and Naming

## Goal

Support converting models to/from plain objects and JSON, plus the naming
conventions Rails uses.

## Scope

- `ActiveModel::Serialization` — `serializable_hash`, `as_json`, `to_json`
- Include/exclude/methods/only options on serialization
- `ActiveModel::Naming` — `model_name` returning an object with `name`, `singular`,
  `plural`, `element`, `collection`, `param_key`, `route_key`, `i18n_key`
- `ActiveModel::Conversion` — `to_param`, `to_partial_path`, `to_key`
- `ActiveModel::Model` — a convenience mixin that bundles the above

## Rails Reference

- https://api.rubyonrails.org/classes/ActiveModel/Serialization.html
- https://api.rubyonrails.org/classes/ActiveModel/Naming.html
- https://api.rubyonrails.org/classes/ActiveModel/Model.html
