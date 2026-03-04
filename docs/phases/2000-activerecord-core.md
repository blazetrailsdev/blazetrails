# Phase 2000: ActiveRecord Core and Connection

## Goal

Establish the base ActiveRecord class with a pluggable database adapter layer
and basic persistence (create, read, update, delete).

## Scope

- `ActiveRecord::Base` extending ActiveModel
- Database adapter interface (pluggable: sqlite, pg, mysql)
- Connection configuration and pooling interface
- `save`, `save!`, `create`, `create!`, `update`, `update!`, `destroy`, `destroy!`
- `new_record?`, `persisted?`, `destroyed?`
- `find`, `find_by`, `find_by!`
- Automatic table name inference from class name
- Primary key handling (`id` by default)

## Rails Reference

- https://api.rubyonrails.org/classes/ActiveRecord/Base.html
- https://api.rubyonrails.org/classes/ActiveRecord/Persistence.html
- https://api.rubyonrails.org/classes/ActiveRecord/FinderMethods.html
