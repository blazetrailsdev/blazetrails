# Phase 1200: ActiveModel Callbacks and Dirty Tracking

## Goal

Add lifecycle callbacks and change-tracking to models.

## Scope

- `ActiveModel::Callbacks` — `before_validation`, `after_validation`,
  `before_save`, `after_save`, `before_create`, `after_create`, etc.
- `ActiveModel::Dirty` — `changed?`, `changed`, `changes`,
  `previous_changes`, `<attr>_changed?`, `<attr>_was`, `<attr>_change`,
  `restore_attributes`
- Callback halting (returning false / throwing `:abort`)

## Rails Reference

- https://api.rubyonrails.org/classes/ActiveModel/Callbacks.html
- https://api.rubyonrails.org/classes/ActiveModel/Dirty.html
