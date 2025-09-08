import mysql from 'mysql2/promise';



let pool: any = null;

export function connect() {
  return mysql.createPool({
    host: process.env.TIDB_HOST as string, // TiDB host, for example: {gateway-region}.aws.tidbcloud.com
    port: (process.env.TIDB_PORT as unknown as number) || 4000, // TiDB port, default: 4000
    user: process.env.TIDB_USER as string, // TiDB user, for example: {prefix}.root
    password: process.env.TIDB_PASSWORD as string, // TiDB password
    database: process.env.TIDB_DATABASE as string || 'test', // TiDB database name, default: test
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    connectionLimit: 1, // Setting connectionLimit to "1" in a serverless function environment optimizes resource usage, reduces costs, ensures connection stability, and enables seamless scalability.
    maxIdle: 1, // max idle connections, the default value is the same as `connectionLimit`
    enableKeepAlive: true,
  });
}

export function getConnection() {
  if (!pool) {
    pool = connect();
  }
  return pool;
}