// vendor/rails/activerecord/test/models/book_encrypted.rb
import { Base } from "../../base.js";

export class UnencryptedBook extends Base {
  static _tableName = "encrypted_books";
}

export class EncryptedBook extends Base {
  static _tableName = "encrypted_books";

  static {
    this.encrypts("name", { deterministic: true });
  }
}

export class EncryptedBookWithUniquenessValidation extends Base {
  static _tableName = "encrypted_books";

  static {
    this.validates("name", { uniqueness: true });
    this.encrypts("name", { deterministic: true });
  }
}

export class EncryptedBookWithDowncaseName extends Base {
  static _tableName = "encrypted_books";

  static {
    this.validates("name", { uniqueness: true });
    this.encrypts("name", { deterministic: true, downcase: true });
  }
}

export class EncryptedBookNormalizedFirst extends Base {
  static _tableName = "encrypted_books";

  static {
    this.normalizes("name", (v: unknown) => String(v).toLowerCase());
    this.encrypts("name");
    this.normalizes("logo", (v: unknown) => String(v).toLowerCase());
    this.encrypts("logo");
  }
}

export class EncryptedBookNormalizedSecond extends Base {
  static _tableName = "encrypted_books";

  static {
    this.encrypts("name");
    this.normalizes("name", (v: unknown) => String(v).toLowerCase());
    this.encrypts("logo");
    this.normalizes("logo", (v: unknown) => String(v).toLowerCase());
  }
}

export class EncryptedBookAttribute extends Base {
  static _tableName = "encrypted_books";

  static {
    this.attribute("name", "date");
    this.encrypts("name");
  }
}

export class EncryptedBookThatIgnoresCase extends Base {
  static _tableName = "encrypted_books";

  static {
    this.encrypts("name", { deterministic: true, ignoreCase: true });
  }
}

export class EncryptedBookWithUnencryptedDataOptedOut extends Base {
  static _tableName = "encrypted_books";

  static {
    this.validates("name", { uniqueness: true });
    this.encrypts("name", { deterministic: true, supportUnencryptedData: false });
  }
}

export class EncryptedBookWithUnencryptedDataOptedIn extends Base {
  static _tableName = "encrypted_books";

  static {
    this.validates("name", { uniqueness: true });
    this.encrypts("name", { deterministic: true, supportUnencryptedData: true });
  }
}

export class EncryptedBookWithBinary extends Base {
  static _tableName = "encrypted_books";

  static {
    this.encrypts("logo");
  }
}

export class EncryptedBookWithSerializedFirstBinary extends Base {
  static _tableName = "encrypted_books";

  static {
    this.serialize("logo", { coder: JSON });
    this.encrypts("logo");
  }
}

export class EncryptedBookWithSerializedSecondBinary extends Base {
  static _tableName = "encrypted_books";

  static {
    this.encrypts("logo");
    this.serialize("logo", { coder: JSON });
  }
}

export class EncryptedBookWithCustomCompressor extends Base {
  static _tableName = "encrypted_books";

  static {
    this.encrypts("name", {
      compressor: {
        deflate: (value: string): Buffer => Buffer.from(`[compressed] ${value}`),
        inflate: (data: Buffer | Uint8Array): string => Buffer.from(data).toString(),
      },
    });
  }
}
