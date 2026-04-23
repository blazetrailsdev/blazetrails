posts = Arel::Table.new(:posts)
posts.project(Arel::Nodes::SqlLiteral.new('id'), Arel::Nodes::SqlLiteral.new('title'))
