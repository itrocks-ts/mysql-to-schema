import { Table }         from '@itrocks/table-schema'
import { Connection }    from 'mariadb'
import { MysqlToColumn } from './mysql-to-column'
import { MysqlToIndex }  from './mysql-to-index'

export interface MysqlTable
{
	TABLE_COLLATION: string
	ENGINE:          'ARCHIVE' | 'BDB' | 'CSV' | 'FEDERATED' | 'InnoDB' | 'MyISAM' | 'MEMORY' | 'MERGE' | 'NDBCluster'
	TABLE_NAME:      string
}

export class MysqlToTable
{

	mysqlToColumn: MysqlToColumn
	mysqlToIndex:  MysqlToIndex

	constructor(
		public connection: Connection,
	) {
		this.mysqlToColumn = new MysqlToColumn(this.connection)
		this.mysqlToIndex  = new MysqlToIndex(this.connection)
	}

	async convert(tableName: string, databaseName?: string): Promise<Table>
	{
		const databaseSql = databaseName ? `'${databaseName}'` : 'DATABASE()'
		const query  = 'SELECT ENGINE, TABLE_COLLATION, TABLE_NAME'
			+ ' FROM information_schema.TABLES'
			+ ` WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = ${databaseSql}`
		return this.rowToTable((await this.connection.query<MysqlTable[]>(query))[0], databaseName)
	}

	async convertMultiple(databaseName?: string): Promise<Table[]>
	{
		const databaseSql = databaseName ? `'${databaseName}'` : 'DATABASE()'
		const query  = 'SELECT ENGINE, TABLE_COLLATION, TABLE_NAME'
			+ ' FROM information_schema.TABLES'
			+ ` WHERE TABLE_SCHEMA = ${databaseSql}`
			+ ' ORDER BY TABLE_NAME'
		const tables: Promise<Table>[] = []
		for (const row of await this.connection.query<MysqlTable[]>(query)) {
			tables.push(this.rowToTable(row, databaseName))
		}
		return Promise.all(tables)
	}

	async rowToTable(row: MysqlTable, databaseName?: string): Promise<Table>
	{
		return new Table(row.TABLE_NAME, {
			collation: row.TABLE_COLLATION,
			columns:   await this.mysqlToColumn.convertMultiple(row.TABLE_NAME, databaseName),
			engine:    row.ENGINE,
			indexes:   await this.mysqlToIndex.convertMultiple(row.TABLE_NAME, databaseName)
		})
	}

	normalize(table: Table)
	{
		const mysqlToType = this.mysqlToColumn.mysqlToType
		for (const column of table.columns) {
			mysqlToType.normalize(column.type)
		}
	}

}
