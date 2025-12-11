[![npm version](https://img.shields.io/npm/v/@itrocks/mysql-to-schema?logo=npm)](https://www.npmjs.org/package/@itrocks/mysql-to-schema)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/mysql-to-schema)](https://www.npmjs.org/package/@itrocks/mysql-to-schema)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/mysql-to-schema?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/mysql-to-schema)
[![issues](https://img.shields.io/github/issues/itrocks-ts/mysql-to-schema)](https://github.com/itrocks-ts/mysql-to-schema/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# mysql-to-schema

Extracts a MySQL table structure and converts it into a table schema.
 
*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/mysql-to-schema mariadb
```

You must also have access to a running MySQL or MariaDB server and the
necessary credentials to connect to it.

## Usage

`@itrocks/mysql-to-schema` exposes a single entry point,
`MysqlToTable`, which reads the structure of one or more tables from a
MySQL/MariaDB database and converts them to `Table` objects from the
`@itrocks/schema` package.

The resulting schema objects can then be used by other
`@itrocks/*` utilities (such as `@itrocks/schema-diff` or
`@itrocks/schema-to-mysql`) to compare, migrate, or generate database
structures.

### Minimal example: read one table

```ts
import mariadb              from 'mariadb'
import { MysqlToTable }     from '@itrocks/mysql-to-schema'
import type { Connection }  from 'mariadb'

async function main() {
  const pool = mariadb.createPool({
    host:     'localhost',
    user:     'root',
    password: 'secret',
    database: 'my_app',
  })

  const connection: Connection = await pool.getConnection()

  try {
    const mysqlToTable = new MysqlToTable(connection)

    // Read the schema of the `user` table from the current database
    const table = await mysqlToTable.convert('user')

    console.log(table.name)      // 'user'
    console.log(table.columns)   // array of Column definitions
    console.log(table.indexes)   // array of Index definitions
  }
  finally {
    connection.release()
    await pool.end()
  }
}

main().catch(console.error)
```

### Complete example: synchronize table structure with application model

The package is typically combined with
`@itrocks/reflect-to-schema`, `@itrocks/schema-diff`, and
`@itrocks/schema-to-mysql` (for instance via
`@itrocks/mysql-maintainer`) to keep an existing database in sync with
your application model.

Below is a simplified, standalone example showing the core idea:

```ts
import mariadb                              from 'mariadb'
import type { Connection }                  from 'mariadb'
import { MysqlToTable }                     from '@itrocks/mysql-to-schema'
import { ReflectToTable }                   from '@itrocks/reflect-to-schema'
import { TableDiff }                        from '@itrocks/schema-diff'
import { SchemaDiffMysql }                  from '@itrocks/schema-diff-mysql'
import { SchemaToMysql }                    from '@itrocks/schema-to-mysql'

class User {
  id!: number
  email!: string
}

async function synchronizeUserTable(connection: Connection) {
  const tableName = 'user'

  // Schema from the database
  const mysqlToTable   = new MysqlToTable(connection)
  const existingSchema = await mysqlToTable.convert(tableName)
  mysqlToTable.normalize(existingSchema)

  // Schema from the TypeScript model
  const reflectToTable = new ReflectToTable()
  const targetSchema   = reflectToTable.convert(User)

  // Compute the diff and translate it to SQL
  const diff           = new TableDiff(existingSchema, targetSchema)
  const diffToMysql    = new SchemaDiffMysql()
  const sql            = diffToMysql.sql(diff, /* allowDeletions */ false)

  if (sql.trim()) {
    await connection.query(sql)
  }
}

async function main() {
  const pool = mariadb.createPool({
    host:     'localhost',
    user:     'root',
    password: 'secret',
    database: 'my_app',
  })

  const connection = await pool.getConnection()
  try {
    await synchronizeUserTable(connection)
  }
  finally {
    connection.release()
    await pool.end()
  }
}

main().catch(console.error)
```

In real-world applications you will often use
`@itrocks/mysql-maintainer`, which wraps this pattern for you and
relies on `MysqlToTable` under the hood.

## API

### `class MysqlToTable`

Main entry point of the package. Wraps a MariaDB/MySQL connection and
provides methods to read table structures and convert them into
`@itrocks/schema` `Table` instances.

`MysqlToTable` is an alias of the internal `ToTable` class exported by
this package.

#### Constructor

```ts
new MysqlToTable(connection: Connection)
```

Creates a converter bound to a given MariaDB connection.

##### Parameters

- `connection: Connection` – an open `mariadb` connection. The
  instance remains the caller's responsibility: you must handle
  creation, error management, and closing of the connection.

#### Methods

##### `convert(tableName: string, databaseName?: string): Promise<Table>`

Reads the structure of a single table from the database and converts it
to a `Table` instance from `@itrocks/schema`.

- `tableName` – the name of the table to inspect.
- `databaseName` *(optional)* – explicit database name. If omitted, the
  current database of the connection (`DATABASE()`) is used.

The returned `Table` contains the table name, collation, engine,
columns, and indexes.

##### `convertMultiple(databaseName?: string): Promise<Table[]>`

Reads all tables from a database and returns an array of `Table`
instances.

- `databaseName` *(optional)* – explicit database name. If omitted, the
  current database of the connection is used.

Tables are ordered by name, matching the `ORDER BY TABLE_NAME` clause
used internally.

##### `rowToTable(row: MysqlTable, databaseName?: string): Promise<Table>`

Low-level helper that converts a single row from
`information_schema.TABLES` into a `Table` instance. You typically do
not call this directly; it is used internally by `convert` and
`convertMultiple`.

##### `normalize(table: Table): void`

Normalizes the column types of a `Table` instance so that they can be
compared more easily with other schema representations (for instance
those generated by `@itrocks/reflect-to-schema`).

This mutates the given `table` object in place.

## Typical use cases

- Inspect the structure of an existing MySQL/MariaDB table from a
  running database and expose it as a `Table` object.
- Generate comparison diffs between a live database and a schema
  defined in code (for example, to migrate an existing database to a
  new model).
- Build tooling that automatically synchronizes database schemas based
  on differences between the live database and your application's
  desired structure.
- List all tables in a database along with their columns, collations,
  engines, and indexes, either for introspection tools or for
  documentation purposes.
