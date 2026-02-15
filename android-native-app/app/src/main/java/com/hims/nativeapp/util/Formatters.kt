package com.hims.nativeapp.util

import java.text.DecimalFormat
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

private val moneyFormat = DecimalFormat("#,##0.00")
private val dateFormatter = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US)
private val timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
private val timeWithSecondsFormatter = DateTimeFormatter.ofPattern("h:mm:ss a", Locale.US)
private val twentyFourHourFormatter = DateTimeFormatter.ofPattern("HH:mm", Locale.US)
private val localDateTimePatterns =
    listOf(
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSSSS"),
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS"),
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"),
    )

fun formatPeso(amount: Double): String = "\u20B1${moneyFormat.format(amount)}"

fun formatQty(value: Double): String {
    val whole = value.toLong()
    return if (value == whole.toDouble()) {
        whole.toString()
    } else {
        value.toString()
    }
}

fun extractDatePart(dateTime: String): String {
    return parseLocalDate(dateTime)?.format(DateTimeFormatter.ISO_LOCAL_DATE) ?: dateTime.take(10)
}

fun extractTimePart(dateTime: String): String {
    return parseLocalDateTime(dateTime)?.format(twentyFourHourFormatter) ?: extractTimeFallback(dateTime)
}

fun formatDateHeader(dateTime: String): String {
    val localDate = parseLocalDate(dateTime) ?: return extractDatePart(dateTime).ifBlank { "-" }
    val today = LocalDate.now()
    val diffDays = ChronoUnit.DAYS.between(localDate, today)
    return when (diffDays) {
        0L -> "Today"
        1L -> "Yesterday"
        else -> localDate.format(dateFormatter)
    }
}

fun formatTimeLabel(dateTime: String): String {
    return parseLocalDateTime(dateTime)?.format(timeFormatter)?.lowercase(Locale.US)
        ?: extractTimeFallback(dateTime)
}

fun formatDateTimeLabelWithSeconds(dateTime: String): String {
    val dateLabel = formatDateHeader(dateTime)
    val timeLabel =
        parseLocalDateTime(dateTime)
            ?.format(timeWithSecondsFormatter)
            ?.lowercase(Locale.US)
            ?: formatTimeLabel(dateTime)
    return "$dateLabel $timeLabel"
}

private fun extractTimeFallback(dateTime: String): String {
    val candidate = if (dateTime.length >= 16) dateTime.substring(11, 16) else ""
    return if (candidate.contains(":")) candidate else "00:00"
}

private fun parseLocalDate(dateTime: String): LocalDate? {
    parseLocalDateTime(dateTime)?.let { return it.toLocalDate() }
    return runCatching {
        LocalDate.parse(dateTime.take(10), DateTimeFormatter.ISO_LOCAL_DATE)
    }.getOrNull()
}

private fun parseLocalDateTime(dateTime: String): LocalDateTime? {
    val raw = dateTime.trim()
    if (raw.isBlank()) {
        return null
    }

    val normalized = if (raw.contains(' ') && !raw.contains('T')) raw.replace(' ', 'T') else raw
    val zone = ZoneId.systemDefault()

    runCatching { Instant.parse(normalized) }.getOrNull()?.let {
        return LocalDateTime.ofInstant(it, zone)
    }

    runCatching { OffsetDateTime.parse(normalized) }.getOrNull()?.let {
        return it.atZoneSameInstant(zone).toLocalDateTime()
    }

    runCatching { ZonedDateTime.parse(normalized) }.getOrNull()?.let {
        return it.withZoneSameInstant(zone).toLocalDateTime()
    }

    runCatching { LocalDateTime.parse(normalized, DateTimeFormatter.ISO_LOCAL_DATE_TIME) }.getOrNull()?.let {
        return it
    }

    localDateTimePatterns.forEach { formatter ->
        runCatching { LocalDateTime.parse(normalized, formatter) }.getOrNull()?.let {
            return it
        }
    }

    runCatching { LocalDate.parse(raw.take(10), DateTimeFormatter.ISO_LOCAL_DATE) }.getOrNull()?.let {
        return it.atStartOfDay()
    }

    return null
}

fun fullImageUrl(baseUrl: String, image: String?): String? {
    if (image.isNullOrBlank()) return null

    val raw = image.trim().replace('\\', '/')
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
        val parsedRaw = raw.toHttpUrlOrNull() ?: return raw
        val base = baseUrl.toHttpUrlOrNull()
        if (base == null) {
            return raw
        }

        val rawHost = parsedRaw.host.lowercase(Locale.US)
        val isLoopbackHost =
            rawHost == "localhost" ||
                rawHost == "127.0.0.1" ||
                rawHost == "0.0.0.0" ||
                rawHost == "::1"

        if (!isLoopbackHost) {
            return raw
        }

        return parsedRaw
            .newBuilder()
            .scheme(base.scheme)
            .host(base.host)
            .port(base.port)
            .build()
            .toString()
    }

    val cleanBase = if (baseUrl.endsWith("/")) baseUrl.dropLast(1) else baseUrl
    val normalized = raw.removePrefix("./")
    val resolvedPath =
        when {
            normalized.startsWith("/") -> normalized
            normalized.startsWith("storage/") -> "/$normalized"
            normalized.startsWith("public/") -> "/storage/${normalized.removePrefix("public/")}"
            else -> "/storage/$normalized"
        }

    return cleanBase + resolvedPath
}
