import type { Database, Statement } from "bun:sqlite";
import type {
	BatchStatus,
	BatchStorageCreate,
	BatchStorageUpdate,
	MessageStorageCreate,
	MessageStorageUpdate,
	Storage,
} from "../types";

export class BunSQLiteStorage implements Storage {
	private $create_batch: Statement;
	private $update_batch: Statement;
	private $random_batches: Statement<{ id: string }>;

	private $create_message: Statement;
	private $update_message: Statement;

	constructor(
		database: Database,
		batch_table = "batch",
		message_table = "message",
	) {
		database.run(`
			CREATE TABLE IF NOT EXISTS ${batch_table} (
				id TEXT PRIMARY KEY,
				status TEXT NOT NULL
			);

			CREATE INDEX ${batch_table}_status_idx ON ${batch_table}(status);

			CREATE TABLE IF NOT EXISTS ${message_table} (
				id TEXT PRIMARY KEY,
				batch_id TEXT NOT NULL,
				status TEXT NOT NULL,
				content TEXT NOT NULL,
				input_tokens INTEGER,
				output_tokens INTEGER,
				cache_creation_input_tokens INTEGER,
				cache_read_input_tokens INTEGER,
				error TEXT,
				FOREIGN KEY(batch_id) REFERENCES ${batch_table}(id)
			);

			CREATE INDEX message_batch_id_idx ON ${message_table}(batch_id);
			CREATE INDEX message_status_idx ON ${message_table}(status);
		`);

		this.$create_batch = database.prepare(`
			INSERT OR IGNORE INTO 
			${batch_table} (id, status) 
			VALUES ($id, $status);
		`);

		this.$update_batch = database.prepare(`
			UPDATE OR IGNORE ${batch_table}	
			SET status = $status
			WHERE id = $id;
		`);

		this.$random_batches = database.prepare(`
			SELECT id FROM ${batch_table}
			WHERE status = $status
			ORDER BY RANDOM()
			LIMIT $limit;
		`);

		this.$create_message = database.prepare(`
			INSERT OR IGNORE INTO
			${message_table} (id, batch_id, status, content)
			VALUES ($id, $batch_id, $status, $content);
		`);

		this.$update_message = database.prepare(`
			UPDATE OR IGNORE ${message_table}	
			SET status = $status, 
			cache_creation_input_tokens = COALESCE($cache_creation_input_tokens, cache_creation_input_tokens),
			cache_read_input_tokens = COALESCE($cache_read_input_tokens, cache_read_input_tokens),
			input_tokens = COALESCE($input_tokens, input_tokens),
			output_tokens = COALESCE($output_tokens, output_tokens),
			error = COALESCE($error, error)
			WHERE id = $id;
		`);
	}

	async createBatch(batch_data: BatchStorageCreate) {
		this.$create_batch.run({
			$id: batch_data.id,
			$status: batch_data.status,
		});
	}

	async updateBatch(batch_data: BatchStorageUpdate) {
		this.$update_batch.run({
			$id: batch_data.id,
			$status: batch_data.status,
		});
	}

	async randomBatches(limit: number, status: BatchStatus) {
		const batches = this.$random_batches.all({
			$limit: limit,
			$status: status,
		});

		return batches.map((v) => v.id);
	}

	async createMessage(message_data: MessageStorageCreate) {
		this.$create_message.run({
			$id: message_data.id,
			$batch_id: message_data.batch_id,
			$status: message_data.status,
			$content: message_data.content,
		});
	}

	async updateMessage(message_data: MessageStorageUpdate) {
		this.$update_message.run({
			$id: message_data.id,
			$status: message_data.status,
			$cache_creation_input_tokens: message_data.cache_creation_input_tokens,
			$cache_read_input_tokens: message_data.cache_read_input_tokens,
			$input_tokens: message_data.input_tokens,
			$output_tokens: message_data.output_tokens,
			$error: message_data.error,
		});
	}
}
