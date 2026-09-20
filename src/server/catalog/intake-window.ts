const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

function requireSqlIdentifier(value: string) {
  if (!SQL_IDENTIFIER.test(value)) throw new Error("Invalid SQL identifier for intake window.");
  return value;
}

export function currentIntakeWindowSql(alias = "pi", nowExpression = "clock_timestamp()") {
  const table = requireSqlIdentifier(alias);
  return `(${table}.open_date is null or ${table}.open_date <= ${nowExpression})
    and (${table}.deadline_date is null or ${table}.deadline_date > ${nowExpression})
    and (${table}.open_date is null or ${table}.deadline_date is null or ${table}.open_date < ${table}.deadline_date)`;
}

export function upcomingIntakeWindowSql(alias = "pi", nowExpression = "clock_timestamp()") {
  const table = requireSqlIdentifier(alias);
  return `${table}.open_date is not null and ${table}.open_date > ${nowExpression}
    and (${table}.deadline_date is null or ${table}.deadline_date > ${table}.open_date)`;
}
