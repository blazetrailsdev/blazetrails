Book.where(active: true).order(:title).except(:order)
