import { Column }     from '@itrocks/schema'
import { Connection } from 'mariadb'
import { ToType }     from './to-type'

export interface MysqlColumn
{
	CHARACTER_SET_NAME: string
	COLLATION_NAME:     string
	COLUMN_DEFAULT:     string
	COLUMN_KEY:         '' | 'MUL' | 'PRI' | 'UNI'
	COLUMN_NAME:        string
	COLUMN_TYPE:        string
	EXTRA:              string
	IS_NULLABLE:        'NO' | 'YES'
}

export class ToColumn
{

	constructor(
		public connection: Connection,
		public toType    = new ToType()
	) {}

	async convert(columnName: string, tableName: string, databaseName?: string): Promise<Column>
	{
		databaseName = databaseName ? `'${databaseName}'` : 'DATABASE()'
		const query = 'SELECT'
			+ ' CHARACTER_SET_NAME, COLLATION_NAME, COLUMN_DEFAULT, COLUMN_KEY, COLUMN_NAME, COLUMN_TYPE, EXTRA, IS_NULLABLE'
			+ ' FROM information_schema.COLUMNS'
			+ ` WHERE COLUMN_NAME = '${columnName}' AND TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = ${databaseName}`
		return this.rowToColumn((await this.connection.query<MysqlColumn[]>(query))[0])
	}

	async convertMultiple(tableName: string, databaseName?: string): Promise<Column[]>
	{
		databaseName = databaseName ? `'${databaseName}'` : 'DATABASE()'
		const query = 'SELECT'
			+ ' CHARACTER_SET_NAME, COLLATION_NAME, COLUMN_DEFAULT, COLUMN_KEY, COLUMN_NAME, COLUMN_TYPE, EXTRA, IS_NULLABLE'
			+ ' FROM information_schema.COLUMNS'
			+ ` WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = ${databaseName}`
			+ ' ORDER BY COLUMN_NAME'
		const columns: Column[] = []
		for (const row of await this.connection.query<MysqlColumn[]>(query)) {
			columns.push(this.rowToColumn(row))
		}
		return columns
	}

	rowToColumn(row: MysqlColumn): Column
	{
		const type   = this.toType.convert(row.COLUMN_TYPE)
		if (row.COLLATION_NAME) {
			type.collate = row.COLLATION_NAME
		}
		const column = new Column(row.COLUMN_NAME, type, {
			autoIncrement: row.EXTRA.includes('auto_increment'),
			canBeNull:     row.IS_NULLABLE === 'YES',
			default:       row.COLUMN_DEFAULT
		})
		if (((column.default === null) || (column.default === undefined)) && !column.canBeNull) {
			column.default = (type.name === 'string') ? '' : undefined
		}
		return column
	}

}
