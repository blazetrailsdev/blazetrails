// vendor/rails/activerecord/test/models/lesson.rb
import { Base } from "../../base.js";

export class LessonError extends Error {}

export class Lesson extends Base {
  static {
    this.hasAndBelongsToMany("students");
    this.beforeDestroy(function (this: any) {
      return this.ensureNoStudents();
    });
  }

  ensureNoStudents() {
    if (!(this as any).students.isEmpty()) throw new LessonError();
  }
}
