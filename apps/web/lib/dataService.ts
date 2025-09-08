import { getConnection } from '@/lib/mysql';


export class DataService {  
  pool: any;

  constructor() {
    this.pool = getConnection();
  }

  singleQuery(sql: any, ...args: any[]) {
    return new Promise((resolve, reject) => {
      this.pool.query(sql, ...args, (err: any, results: any, fields: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({ results, fields });
        }
      });
    });
  }

  async close() {
    return new Promise<void>((resolve, reject) => {
      this.pool.end((err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}