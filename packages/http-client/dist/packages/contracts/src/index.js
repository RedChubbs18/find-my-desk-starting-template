"use strict";
// ============================================================================
// Core Domain Types
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingStatus = exports.ErrorCode = void 0;
exports.makeUserId = makeUserId;
exports.makeDeskId = makeDeskId;
exports.makeNeighbourhoodId = makeNeighbourhoodId;
exports.makeOfficeId = makeOfficeId;
exports.makeBookingId = makeBookingId;
exports.makeRecommendationId = makeRecommendationId;
exports.makeCorrelationId = makeCorrelationId;
function makeUserId(value) {
    return value;
}
function makeDeskId(value) {
    return value;
}
function makeNeighbourhoodId(value) {
    return value;
}
function makeOfficeId(value) {
    return value;
}
function makeBookingId(value) {
    return value;
}
function makeRecommendationId(value) {
    return value;
}
function makeCorrelationId(value) {
    return value;
}
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
// ============================================================================
// Booking Service Contracts
// ============================================================================
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "PENDING";
    BookingStatus["CONFIRMED"] = "CONFIRMED";
    BookingStatus["CANCELLED"] = "CANCELLED";
    BookingStatus["EXPIRED"] = "EXPIRED";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
