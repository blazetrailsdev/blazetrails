import { Book } from "./models.js";

const Pagination = {
  perPage(n: number) {
    return (this as any).limit(n);
  },
};

export default Book.where({ id: 1 }).extending(Pagination);
