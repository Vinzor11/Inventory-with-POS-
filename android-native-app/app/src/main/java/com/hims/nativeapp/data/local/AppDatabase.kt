package com.hims.nativeapp.data.local

import android.content.Context
import androidx.paging.PagingSource
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "bootstrap_state")
data class BootstrapStateEntity(
    @PrimaryKey val id: Int = 1,
    val userId: Int,
    val userName: String,
    val userRole: String,
    val branchId: Int,
    val branchName: String,
    val currency: String,
    val timezone: String,
    val permissionsJson: String,
    val configJson: String,
    val posSeedJson: String,
    val updatedAtEpochMs: Long,
)

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val id: Int,
    val name: String,
)

@Entity(tableName = "payment_methods")
data class PaymentMethodEntity(
    @PrimaryKey val id: String,
    val name: String,
)

@Entity(tableName = "cache_meta")
data class CacheMetaEntity(
    @PrimaryKey val key: String,
    val etag: String?,
    val fetchedAtEpochMs: Long,
    val ttlSeconds: Long,
    val lastModified: String?,
) {
    fun isStale(nowEpochMs: Long): Boolean {
        return nowEpochMs - fetchedAtEpochMs > ttlSeconds * 1000L
    }
}

@Entity(
    tableName = "outbox_events",
    indices = [
        Index("status"),
        Index(value = ["status", "createdAtEpochMs"]),
    ],
)
data class OutboxEventEntity(
    @PrimaryKey val id: String,
    val type: String,
    val payloadJson: String,
    val status: String,
    val retries: Int,
    val createdAtEpochMs: Long,
)

@Entity(
    tableName = "products_paged",
    primaryKeys = ["searchKey", "variantId"],
    indices = [
        Index("searchKey"),
        Index("name"),
        Index("sku"),
    ],
)
data class ProductPagedEntity(
    val searchKey: String,
    val variantId: Int,
    val productId: Int,
    val name: String,
    val description: String,
    val sku: String?,
    val categoryName: String?,
    val unitPrice: Double,
    val availableQuantity: Double,
    val isActive: Boolean,
)

@Entity(tableName = "product_remote_keys")
data class ProductRemoteKeyEntity(
    @PrimaryKey val searchKey: String,
    val nextPage: Int?,
    val syncedAtEpochMs: Long,
)

@Dao
interface BootstrapStateDao {
    @Query("SELECT * FROM bootstrap_state WHERE id = 1 LIMIT 1")
    suspend fun get(): BootstrapStateEntity?

    @Query("SELECT * FROM bootstrap_state WHERE id = 1 LIMIT 1")
    fun observe(): Flow<BootstrapStateEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: BootstrapStateEntity)

    @Query("DELETE FROM bootstrap_state")
    suspend fun clear()
}

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY name COLLATE NOCASE ASC")
    fun observeAll(): Flow<List<CategoryEntity>>

    @Query("SELECT * FROM categories ORDER BY name COLLATE NOCASE ASC")
    suspend fun getAll(): List<CategoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rows: List<CategoryEntity>)

    @Query("DELETE FROM categories")
    suspend fun clear()
}

@Dao
interface PaymentMethodDao {
    @Query("SELECT * FROM payment_methods ORDER BY name COLLATE NOCASE ASC")
    fun observeAll(): Flow<List<PaymentMethodEntity>>

    @Query("SELECT * FROM payment_methods ORDER BY name COLLATE NOCASE ASC")
    suspend fun getAll(): List<PaymentMethodEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rows: List<PaymentMethodEntity>)

    @Query("DELETE FROM payment_methods")
    suspend fun clear()
}

@Dao
interface CacheMetaDao {
    @Query("SELECT * FROM cache_meta WHERE `key` = :key LIMIT 1")
    suspend fun get(key: String): CacheMetaEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: CacheMetaEntity)

    @Query("UPDATE cache_meta SET fetchedAtEpochMs = :fetchedAtEpochMs WHERE `key` = :key")
    suspend fun touch(key: String, fetchedAtEpochMs: Long)
}

@Dao
interface OutboxEventDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(entity: OutboxEventEntity)

    @Query("SELECT * FROM outbox_events WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): OutboxEventEntity?

    @Query("SELECT * FROM outbox_events WHERE status IN ('PENDING', 'RETRY') ORDER BY createdAtEpochMs ASC LIMIT :limit")
    suspend fun getPending(limit: Int): List<OutboxEventEntity>

    @Query("UPDATE outbox_events SET status = :status, retries = :retries WHERE id = :id")
    suspend fun updateStatus(id: String, status: String, retries: Int)

    @Query("DELETE FROM outbox_events WHERE status = 'SENT' AND createdAtEpochMs < :olderThanEpochMs")
    suspend fun deleteOldSent(olderThanEpochMs: Long)
}

@Dao
interface ProductsPagingDao {
    @Query("SELECT * FROM products_paged WHERE searchKey = :searchKey ORDER BY name COLLATE NOCASE ASC")
    fun pagingSource(searchKey: String): PagingSource<Int, ProductPagedEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rows: List<ProductPagedEntity>)

    @Query("DELETE FROM products_paged WHERE searchKey = :searchKey")
    suspend fun clearBySearchKey(searchKey: String)
}

@Dao
interface ProductRemoteKeyDao {
    @Query("SELECT * FROM product_remote_keys WHERE searchKey = :searchKey LIMIT 1")
    suspend fun get(searchKey: String): ProductRemoteKeyEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ProductRemoteKeyEntity)

    @Query("DELETE FROM product_remote_keys WHERE searchKey = :searchKey")
    suspend fun delete(searchKey: String)
}

@Database(
    entities = [
        BootstrapStateEntity::class,
        CategoryEntity::class,
        PaymentMethodEntity::class,
        CacheMetaEntity::class,
        OutboxEventEntity::class,
        ProductPagedEntity::class,
        ProductRemoteKeyEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun bootstrapStateDao(): BootstrapStateDao
    abstract fun categoryDao(): CategoryDao
    abstract fun paymentMethodDao(): PaymentMethodDao
    abstract fun cacheMetaDao(): CacheMetaDao
    abstract fun outboxEventDao(): OutboxEventDao
    abstract fun productsPagingDao(): ProductsPagingDao
    abstract fun productRemoteKeyDao(): ProductRemoteKeyDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val created = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "hims_pos_cache.db",
                ).build()
                INSTANCE = created
                created
            }
        }
    }
}