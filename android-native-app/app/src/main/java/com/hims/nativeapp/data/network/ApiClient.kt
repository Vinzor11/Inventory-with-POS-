package com.hims.nativeapp.data.network

import com.hims.nativeapp.BuildConfig
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    fun create(sessionStore: SessionStore): ApiService {
        val logging =
            HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) {
                    HttpLoggingInterceptor.Level.BASIC
                } else {
                    HttpLoggingInterceptor.Level.NONE
                }
            }

        val authInterceptor = okhttp3.Interceptor { chain ->
            val original = chain.request()
            val builder =
                original.newBuilder()
                    .header("Accept", "application/json")

            sessionStore.getToken()?.takeIf { it.isNotBlank() }?.let { token ->
                builder.header("Authorization", "Bearer $token")
            }

            chain.proceed(builder.build())
        }

        val client =
            OkHttpClient.Builder()
                .addInterceptor(authInterceptor)
                .addInterceptor(logging)
                .connectionPool(ConnectionPool(5, 5, TimeUnit.MINUTES))
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .build()

        val baseUrl =
            if (BuildConfig.API_BASE_URL.endsWith('/')) {
                BuildConfig.API_BASE_URL
            } else {
                "${BuildConfig.API_BASE_URL}/"
            }

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
