package com.hims.nativeapp.data.network

import android.content.Context

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)

    fun getUserName(): String? = prefs.getString(KEY_USER_NAME, null)

    fun getUserRole(): String? = prefs.getString(KEY_USER_ROLE, null)

    fun saveSession(token: String, userName: String?, userRole: String?) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER_NAME, userName)
            .putString(KEY_USER_ROLE, userRole)
            .apply()
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS = "hims_native_session"
        private const val KEY_TOKEN = "token"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_ROLE = "user_role"
    }
}
