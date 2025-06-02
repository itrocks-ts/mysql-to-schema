import { Type } from '@itrocks/table-schema'

export class MysqlToType
{

	convert(mysqlType: string): Type
	{
		const rawType = mysqlType.substring(0, Math.min((mysqlType + '(').indexOf('('), (mysqlType + ' ').indexOf(' ')))
		switch (rawType) {
			case 'binary': case 'blob': case 'longblob': case 'mediumblob': case 'tinyblob': case 'varbinary':
				return new Type('blob', {
					length:         this.length(rawType, mysqlType),
					variableLength: rawType.startsWith('var')
				})
			case 'bit':
				return new Type('bit')
			case 'boolean':
				return new Type('boolean')
			case 'date':
				return new Type('date')
			case 'datetime':
				return new Type('datetime')
			case 'decimal': case 'double': case 'float': case 'numeric': case 'real':
				return new Type('float', {
					length:    this.length(rawType, mysqlType),
					precision: this.precision(rawType, mysqlType),
					signed:    mysqlType.indexOf('unsigned') < 0,
					zeroFill:  mysqlType.indexOf('zerofill') > 0
				})
			case 'bigint': case 'int': case 'integer': case 'mediumint': case 'smallint': case 'tinyint':
				return new Type('integer', {
					length:   this.length(rawType, mysqlType),
					signed:   mysqlType.indexOf('unsigned') < 0,
					zeroFill: mysqlType.indexOf('zerofill') > 0
				})
			case 'enum': case 'set':
				return new Type(rawType, {
					collate: this.collate(mysqlType),
					values:  this.values(mysqlType)
				})
			case 'time':
				return new Type('time')
			case 'timestamp':
				return new Type('timestamp')
			case 'year':
				return new Type('year')
		}
		// char, longtext, mediumtext, text, tinytext, varchar
		return new Type('string', {
			collate:        this.collate(mysqlType),
			variableLength: rawType.startsWith('var')
		})
	}

	collate(mysqlType: string): string | undefined
	{
		const position = mysqlType.indexOf('collate ')
		if (position > 0) {
			const end = (mysqlType + ' ').indexOf(' ', position + 8)
			return mysqlType.slice(position + 8, end)
		}
	}

	defaultLength(rawType: string): number | undefined
	{
		switch (rawType) {
			case 'bigint':
				return 20
			case 'binary': case 'char': case 'tinyblob': case 'tinytext':
				return 255
			case 'bit':
				return 64
			case 'blob': case 'text': case 'varbinary': case 'varchar':
				return 65_535
			case 'date':
				return 10
			case 'datetime':
				return 19 // missing fractional seconds
			case 'decimal': case 'numeric':
				return 65
			case 'double': case 'float':
				return 53
			case 'enum': case 'set':
				return 1_048_575
			case 'int': case 'integer':
				return 10
			case 'longblob': case 'longtext':
				return 4_294_967_295
			case 'mediumblob': case 'mediumtext':
				return 16_777_215
			case 'mediumint':
				return 8
			case 'smallint':
				return 5
			case 'time':
				return 8 // missing fractional seconds
			case 'tinyint':
				return 3
			case 'year':
				return 4
		}
	}

	defaultPrecision(rawType: string): number | undefined
	{
		switch (rawType) {
			case 'decimal': case 'numeric':
				return 30
			case 'double': case 'float': case 'real':
				return 53
		}
	}

	length(rawType: string, mysqlType: string): number | undefined
	{
		const position = mysqlType.indexOf('(') + 1
		return position
			? +mysqlType.substring(
				position,
				Math.min(mysqlType.indexOf(')', position), (mysqlType + ',').indexOf(',', position))
			)
			: this.defaultLength(rawType)
	}

	precision(rawType: string, mysqlType: string): number | undefined
	{
		const position = mysqlType.indexOf(',', mysqlType.indexOf('(')) + 1
		return position
			? +mysqlType.substring(
				position,
				mysqlType.indexOf(')', position)
			)
			: this.defaultPrecision(rawType)
	}

	values(mysqlType: string): string[]
	{
		const values = new Array<string>()
		let   start  = mysqlType.indexOf("'", mysqlType.indexOf('(') + 1)
		while (start > -1) {
			start ++
			let end = mysqlType.indexOf("'", start)
			while (mysqlType[end + 1] === "'") {
				end = mysqlType.indexOf("'", end + 2)
			}
			values.push(mysqlType.slice(start, end).replaceAll("''", "'"))
			start = mysqlType.indexOf("'", end + 1)
		}
		return values
	}

}
