# Getting Started

## Installation

```bash
pnpm add @blazetrails/activerecord
```

## Quick Example

```ts
import { Base } from "@blazetrails/activerecord";

class User extends Base {
  name!: string;
  email!: string;
}

const users = await User.where({ name: "dean" }).order("created_at").toA();
```
