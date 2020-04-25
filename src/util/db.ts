import * as Knex from 'knex';
import { getConnectionId } from '../config';
import ConnectionConfig from '../domain/ConnectionConfig';
import { dbLogger, log } from './logger';
import ConnectionReference from '../domain/ConnectionReference';

/**
 * Database connections given by the user or the CLI frontend.
 */
export type DatabaseConnections = ConnectionConfig[] | ConnectionConfig | Knex[] | Knex;

/**
 * Returns true if the provided object is a knex connection instance.
 *
 * TODO: Write tests for this supporting both Knex & Knex.Transaction instances.
 *
 * @param {any} obj
 * @returns {boolean}
 */
export function isKnexInstance(obj: any): obj is Knex {
  return !!(obj.prototype && obj.prototype.constructor && obj.prototype.constructor.name === 'knex');
}

/**
 * Extracts the connection config params
 * using provided Knex connection instance.
 *
 * @param {Knex} db
 * @returns {Connection}
 */
export function getConfig(db: Knex): ConnectionConfig {
  return {
    ...db.client.config.connection,
    client: db.client.config.client,
    id: getConnectionId(db.client.config.connection)
  };
}

/**
 * Create a new connection instance (knex) using the connection config.
 *
 * @param {ConnectionConfig} config
 * @returns {Knex}
 */
export function createInstance(config: ConnectionConfig): Knex {
  return Knex({ connection: config, client: config.client });
}

/**
 * Run a callback function with in a transaction.
 *
 * @param {ConnectionReference} db
 * @param {(trx: Knex.Transaction) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export function withTransaction<T>(
  db: ConnectionReference,
  callback: (trx: Knex.Transaction) => Promise<T>
): Promise<T> {
  const dbLog = dbLogger(db.id);

  return db.connection.transaction(async trx => {
    dbLog('BEGIN: transaction');

    const result = await callback(trx);

    dbLog('END: transaction');

    return result;
  });
}

/**
 * Map user provided connection(s) to the connection instances.
 *
 * @param {(DatabaseConnections)} conn
 * @returns {ConnectionReference[]}
 */
export function mapToConnectionReferences(conn: DatabaseConnections): ConnectionReference[] {
  const connectionList = Array.isArray(conn) ? conn : [conn];

  return connectionList.map(connection => {
    if (isKnexInstance(connection)) {
      log(`Received connection instance to database: ${connection.client.config.connection.database}`);

      // TODO: Ask for `id` explicitly in for programmatic API,
      // when Knex instance is passed directly.
      // This implies a breaking change with the programmatic API.
      return { connection, id: getConnectionId(getConfig(connection)) };
    }

    log(`Creating a connection to database: ${connection.host}/${connection.database}`);

    return { connection: createInstance(connection), id: getConnectionId(connection) };
  });
}
