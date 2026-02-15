<?php

namespace App\Services;

use DateTimeInterface;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DatabaseSqlDumpService
{
    public function streamToOutput(): void
    {
        $stream = fopen('php://output', 'wb');

        if ($stream === false) {
            throw new RuntimeException('Unable to open SQL dump output stream.');
        }

        $this->writeSqlDump($stream);

        fclose($stream);
    }

    private function writeSqlDump($stream): void
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();
        $pdo = $connection->getPdo();
        $databaseName = $connection->getDatabaseName() ?: 'database';

        $this->writeLine($stream, '-- HIMS SQL Dump');
        $this->writeLine($stream, '-- Generated at: '.now()->toDateTimeString());
        $this->writeLine($stream, '-- Connection: '.$driver);
        $this->writeLine($stream, '-- Database: '.$databaseName);
        $this->writeLine($stream, '');

        if ($driver === 'mysql') {
            $this->writeLine($stream, 'SET FOREIGN_KEY_CHECKS=0;');
            $this->writeLine($stream, '');
        } elseif ($driver === 'sqlite') {
            $this->writeLine($stream, 'PRAGMA foreign_keys=OFF;');
            $this->writeLine($stream, '');
        }

        foreach ($this->resolveTableNames($connection, $driver) as $table) {
            $this->writeLine($stream, '--');
            $this->writeLine($stream, '-- Table structure for table '.$table);
            $this->writeLine($stream, '--');
            $this->writeLine($stream, 'DROP TABLE IF EXISTS '.$this->quoteIdentifier($table, $driver).';');

            $createTableStatement = $this->resolveCreateTableStatement($connection, $driver, $table);
            if ($createTableStatement !== '') {
                $this->writeLine($stream, rtrim($createTableStatement, ';').';');
            }

            $this->writeLine($stream, '');
            $this->writeLine($stream, '-- Data for table '.$table);

            $quotedTable = $this->quoteIdentifier($table, $driver);
            foreach ($connection->table($table)->cursor() as $row) {
                $rowData = (array) $row;
                if ($rowData === []) {
                    continue;
                }

                $columns = implode(', ', array_map(
                    fn (string $column): string => $this->quoteIdentifier($column, $driver),
                    array_keys($rowData),
                ));

                $values = implode(', ', array_map(
                    fn (mixed $value): string => $this->quoteValue($pdo, $value),
                    array_values($rowData),
                ));

                $this->writeLine(
                    $stream,
                    sprintf('INSERT INTO %s (%s) VALUES (%s);', $quotedTable, $columns, $values),
                );
            }

            $this->writeLine($stream, '');
        }

        if ($driver === 'mysql') {
            $this->writeLine($stream, 'SET FOREIGN_KEY_CHECKS=1;');
        } elseif ($driver === 'sqlite') {
            $this->writeLine($stream, 'PRAGMA foreign_keys=ON;');
        }
    }

    private function resolveTableNames(ConnectionInterface $connection, string $driver): array
    {
        if ($driver === 'mysql') {
            $rows = $connection->select('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');

            return array_values(array_map(
                fn (object $row): string => (string) array_values((array) $row)[0],
                $rows,
            ));
        }

        if ($driver === 'sqlite') {
            $rows = $connection->select("
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                  AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            ");

            return array_values(array_map(
                fn (object $row): string => (string) ($row->name ?? ''),
                $rows,
            ));
        }

        throw new RuntimeException("SQL dump export does not support the '{$driver}' database driver.");
    }

    private function resolveCreateTableStatement(ConnectionInterface $connection, string $driver, string $table): string
    {
        if ($driver === 'mysql') {
            $result = (array) $connection->selectOne('SHOW CREATE TABLE '.$this->quoteIdentifier($table, $driver));
            $createTable = $result['Create Table'] ?? null;

            if (is_string($createTable) && $createTable !== '') {
                return $createTable;
            }

            $values = array_values($result);

            return isset($values[1]) ? (string) $values[1] : '';
        }

        if ($driver === 'sqlite') {
            $row = $connection->selectOne(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
                [$table],
            );

            return (string) ($row->sql ?? '');
        }

        return '';
    }

    private function quoteIdentifier(string $identifier, string $driver): string
    {
        if ($driver === 'mysql') {
            return '`'.str_replace('`', '``', $identifier).'`';
        }

        return '"'.str_replace('"', '""', $identifier).'"';
    }

    private function quoteValue(\PDO $pdo, mixed $value): string
    {
        if ($value === null) {
            return 'NULL';
        }

        if ($value instanceof DateTimeInterface) {
            return $pdo->quote($value->format('Y-m-d H:i:s'));
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        if (is_resource($value)) {
            $value = stream_get_contents($value) ?: '';
        } elseif (is_array($value) || is_object($value)) {
            $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        return $pdo->quote((string) $value);
    }

    private function writeLine($stream, string $line): void
    {
        fwrite($stream, $line.PHP_EOL);
    }
}
