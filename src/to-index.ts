import { Index }      from '@itrocks/schema'
import { IndexKey }   from '@itrocks/schema'
import { IndexType }  from '@itrocks/schema'
import { Connection } from 'mariadb'

export interface MysqlIndex
{
	INDEX_NAME: string
	INDEX_TYPE: IndexType
	NON_UNIQUE: boolean
}

export interface MysqlIndexKey
{
	COLUMN_NAME:  string
	SEQ_IN_INDEX: number
	SUB_PART:     number | null
}

export interface MysqlIndexRow extends MysqlIndex, MysqlIndexKey
{}

export class ToIndex
{

	constructor(public connection: Connection)
	{}

	async convert(indexName: string, tableName: string, databaseName?: string): Promise<Index>
	{
		databaseName = databaseName ? `'${databaseName}'` : 'DATABASE()'
		const query = 'SELECT COLUMN_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE, SEQ_IN_INDEX, SUB_PART'
			+ ' FROM information_schema.STATISTICS'
			+ ` WHERE INDEX_NAME = '${indexName}' AND TABLE_SCHEMA = ${databaseName} AND TABLE_NAME = '${tableName}'`
			+ ' ORDER BY SEQ_IN_INDEX'
		return this.rowsToIndex(...await this.connection.query<MysqlIndexRow[]>(query))
	}

	async convertMultiple(tableName: string, databaseName?: string): Promise<Index[]>
	{
		databaseName = databaseName ? `'${databaseName}'` : 'DATABASE()'
		const query = 'SELECT COLUMN_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE, SEQ_IN_INDEX, SUB_PART'
			+ ' FROM information_schema.STATISTICS'
			+ ` WHERE TABLE_SCHEMA = ${databaseName} AND TABLE_NAME = '${tableName}'`
			+ ' ORDER BY INDEX_NAME, SEQ_IN_INDEX'
		console.log(query)
		const indexes: Index[] = []
		let   lastRow: MysqlIndexRow | undefined = undefined
		const rows:    MysqlIndexRow[] = []
		for (const row of await this.connection.query<MysqlIndexRow[]>(query)) {
			if (lastRow && (row.INDEX_NAME !== lastRow.INDEX_NAME)) {
				indexes.push(this.rowsToIndex(...rows))
				rows.length = 0
			}
			rows.push(row)
			lastRow = row
		}
		if (rows.length) {
			indexes.push(this.rowsToIndex(...rows))
		}
		return indexes
	}

	rowsToIndex(...rows: MysqlIndexRow[]): Index
	{
		const keys: IndexKey[] = []
		for (const row of rows) {
			keys.push(this.rowToKey(row))
		}
		const row = rows[0]
		return new Index(
			row.INDEX_NAME,
			keys,
			{ type: row.NON_UNIQUE ? 'key' : ((row.INDEX_NAME === 'PRIMARY') ? 'primary' : 'unique'), unique: !row.NON_UNIQUE }
		)
	}

	rowToKey(row: MysqlIndexKey): IndexKey
	{
		return new IndexKey(row.COLUMN_NAME, row.SUB_PART ?? undefined)
	}

}
