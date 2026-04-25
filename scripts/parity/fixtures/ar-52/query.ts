import { Range } from "@blazetrails/activerecord";
import { Order } from "./models.js";

const now = new Date();
const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
export default Order.where({ created_at: new Range(weekAgo, now) });
