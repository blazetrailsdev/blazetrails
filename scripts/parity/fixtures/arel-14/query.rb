users = Arel::Table.new(:users)
users[:name].not_in(%w[Mike Molly])
