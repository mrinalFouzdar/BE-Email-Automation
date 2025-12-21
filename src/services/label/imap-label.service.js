"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setImapLabel = setImapLabel;
exports.setImapLabels = setImapLabels;
exports.syncAILabelToImap = syncAILabelToImap;
exports.initializeSystemLabelsInMailbox = initializeSystemLabelsInMailbox;
var imapflow_1 = require("imapflow");
var encryption_service_1 = require("./encryption.service");
/**
 * Creates an ImapFlow client connection
 */
function createImapClient(account) {
    return __awaiter(this, void 0, void 0, function () {
        var password, client;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    password = (0, encryption_service_1.decryptPassword)(account.imap_password_encrypted);
                    // console.log("🚀 ~ createImapClient ~ password:", password);
                    client = new imapflow_1.ImapFlow({
                        host: account.imap_host,
                        port: account.imap_port,
                        secure: true,
                        auth: {
                            user: account.imap_username,
                            pass: password
                        },
                        logger: false
                    });
                    return [4 /*yield*/, client.connect()];
                case 1:
                    _a.sent();
                    return [2 /*return*/, client];
            }
        });
    });
}
/**
 * Sets a label/flag on an IMAP email by Message-ID
 * For Gmail IMAP: Creates custom label (X-GM-LABELS)
 * For other IMAP: Sets keyword flag
 * @param account - IMAP account credentials
 * @param messageId - Email Message-ID header
 * @param label - Label to add (e.g., "Work", "Important", "AI/Invoice")
 * @returns Success status
 */
function setImapLabel(account, messageId, label) {
    return __awaiter(this, void 0, void 0, function () {
        var client, searchResults, uid, isGmail, gmailLabel_1, labelExists, list, e_1, createError_1, error_1, prefixedLabel, keywordError_1, folderExists, list, e_2, createError_2, importantLabels, isImportant, error_2, keywordError_2, importantLabels, isImportant, error_3, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 50, , 55]);
                    return [4 /*yield*/, createImapClient(account)];
                case 2:
                    client = _a.sent();
                    // Open INBOX mailbox
                    return [4 /*yield*/, client.mailboxOpen('INBOX')];
                case 3:
                    // Open INBOX mailbox
                    _a.sent();
                    return [4 /*yield*/, client.search({
                            header: { 'message-id': messageId }
                        })];
                case 4:
                    searchResults = _a.sent();
                    if (!(!searchResults || searchResults.length === 0)) return [3 /*break*/, 6];
                    return [4 /*yield*/, client.logout()];
                case 5:
                    _a.sent();
                    return [2 /*return*/, { success: false, error: 'Message not found in INBOX' }];
                case 6:
                    uid = searchResults[0];
                    isGmail = account.imap_host.includes('gmail');
                    if (!isGmail) return [3 /*break*/, 26];
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 18, , 25]);
                    gmailLabel_1 = label;
                    labelExists = false;
                    _a.label = 8;
                case 8:
                    _a.trys.push([8, 10, , 11]);
                    return [4 /*yield*/, client.list()];
                case 9:
                    list = _a.sent();
                    labelExists = list.some(function (box) { return box.path === gmailLabel_1; });
                    return [3 /*break*/, 11];
                case 10:
                    e_1 = _a.sent();
                    // If list fails, assume label doesn't exist
                    labelExists = false;
                    return [3 /*break*/, 11];
                case 11:
                    if (!!labelExists) return [3 /*break*/, 15];
                    _a.label = 12;
                case 12:
                    _a.trys.push([12, 14, , 15]);
                    return [4 /*yield*/, client.mailboxCreate(gmailLabel_1)];
                case 13:
                    _a.sent();
                    console.log("  \u2713 Created Gmail label/mailbox: ".concat(gmailLabel_1));
                    return [3 /*break*/, 15];
                case 14:
                    createError_1 = _a.sent();
                    // Label might already exist, continue
                    console.log("  \u2192 Gmail label may already exist: ".concat(gmailLabel_1));
                    return [3 /*break*/, 15];
                case 15: 
                // Copy the message to the label mailbox (this adds the label)
                return [4 /*yield*/, client.messageCopy(uid, gmailLabel_1, { uid: true })];
                case 16:
                    // Copy the message to the label mailbox (this adds the label)
                    _a.sent();
                    console.log("\u2713 Added Gmail label \"".concat(gmailLabel_1, "\" to message ").concat(messageId));
                    return [4 /*yield*/, client.logout()];
                case 17:
                    _a.sent();
                    return [2 /*return*/, { success: true, method: 'gmail-copy' }];
                case 18:
                    error_1 = _a.sent();
                    console.warn("Gmail COPY method failed: ".concat(error_1.message));
                    _a.label = 19;
                case 19:
                    _a.trys.push([19, 22, , 24]);
                    prefixedLabel = label;
                    return [4 /*yield*/, client.messageFlagsAdd(uid, [prefixedLabel], { uid: true })];
                case 20:
                    _a.sent();
                    console.log("\u2713 Added keyword \"".concat(prefixedLabel, "\" to message ").concat(messageId));
                    return [4 /*yield*/, client.logout()];
                case 21:
                    _a.sent();
                    return [2 /*return*/, { success: true, method: 'keyword' }];
                case 22:
                    keywordError_1 = _a.sent();
                    return [4 /*yield*/, client.logout()];
                case 23:
                    _a.sent();
                    return [2 /*return*/, { success: false, error: keywordError_1.message }];
                case 24: return [3 /*break*/, 25];
                case 25: return [3 /*break*/, 49];
                case 26:
                    _a.trys.push([26, 39, , 49]);
                    folderExists = false;
                    _a.label = 27;
                case 27:
                    _a.trys.push([27, 29, , 30]);
                    return [4 /*yield*/, client.list()];
                case 28:
                    list = _a.sent();
                    folderExists = list.some(function (box) { return box.path === label; });
                    return [3 /*break*/, 30];
                case 29:
                    e_2 = _a.sent();
                    folderExists = false;
                    return [3 /*break*/, 30];
                case 30:
                    if (!!folderExists) return [3 /*break*/, 34];
                    _a.label = 31;
                case 31:
                    _a.trys.push([31, 33, , 34]);
                    return [4 /*yield*/, client.mailboxCreate(label)];
                case 32:
                    _a.sent();
                    console.log("  \u2713 Created IMAP folder: ".concat(label));
                    return [3 /*break*/, 34];
                case 33:
                    createError_2 = _a.sent();
                    // Folder might already exist, continue
                    console.log("  \u2192 IMAP folder may already exist: ".concat(label));
                    return [3 /*break*/, 34];
                case 34: 
                // 3. Copy the message to the folder (this creates a labeled copy)
                return [4 /*yield*/, client.messageCopy(uid, label, { uid: true })];
                case 35:
                    // 3. Copy the message to the folder (this creates a labeled copy)
                    _a.sent();
                    console.log("\u2713 Copied email to folder \"".concat(label, "\""));
                    importantLabels = ['urgent', 'escalation', 'priority', 'critical'];
                    isImportant = importantLabels.some(function (imp) {
                        return label.toLowerCase().includes(imp);
                    });
                    if (!isImportant) return [3 /*break*/, 37];
                    return [4 /*yield*/, client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true })];
                case 36:
                    _a.sent();
                    console.log("\u2713 Flagged message as important");
                    _a.label = 37;
                case 37: return [4 /*yield*/, client.logout()];
                case 38:
                    _a.sent();
                    return [2 /*return*/, { success: true, method: 'folder-copy' }];
                case 39:
                    error_2 = _a.sent();
                    _a.label = 40;
                case 40:
                    _a.trys.push([40, 43, , 48]);
                    return [4 /*yield*/, client.messageFlagsAdd(uid, [label], { uid: true })];
                case 41:
                    _a.sent();
                    console.log("\u2713 Added keyword \"".concat(label, "\" to message ").concat(messageId));
                    return [4 /*yield*/, client.logout()];
                case 42:
                    _a.sent();
                    return [2 /*return*/, { success: true, method: 'keyword' }];
                case 43:
                    keywordError_2 = _a.sent();
                    importantLabels = ['urgent', 'important', 'priority', 'critical', 'escalation'];
                    isImportant = importantLabels.some(function (imp) {
                        return label.toLowerCase().includes(imp);
                    });
                    if (!isImportant) return [3 /*break*/, 46];
                    return [4 /*yield*/, client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true })];
                case 44:
                    _a.sent();
                    console.log("\u2713 Flagged message ".concat(messageId, " as important"));
                    return [4 /*yield*/, client.logout()];
                case 45:
                    _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            method: 'flag',
                            error: 'Folders and keywords not supported, used \\Flagged flag instead'
                        }];
                case 46: return [4 /*yield*/, client.logout()];
                case 47:
                    _a.sent();
                    return [2 /*return*/, {
                            success: false,
                            error: 'IMAP server does not support folders, keywords, or custom labels'
                        }];
                case 48: return [3 /*break*/, 49];
                case 49: return [3 /*break*/, 55];
                case 50:
                    error_3 = _a.sent();
                    if (!client) return [3 /*break*/, 54];
                    _a.label = 51;
                case 51:
                    _a.trys.push([51, 53, , 54]);
                    return [4 /*yield*/, client.logout()];
                case 52:
                    _a.sent();
                    return [3 /*break*/, 54];
                case 53:
                    e_3 = _a.sent();
                    return [3 /*break*/, 54];
                case 54:
                    console.error("Error setting IMAP label:", error_3.message);
                    return [2 /*return*/, { success: false, error: error_3.message }];
                case 55: return [2 /*return*/];
            }
        });
    });
}
/**
 * Sets multiple labels on an IMAP email
 * @param account - IMAP account credentials
 * @param messageId - Email Message-ID header
 * @param labels - Array of labels to add
 * @returns Success status
 */
function setImapLabels(account, messageId, labels) {
    return __awaiter(this, void 0, void 0, function () {
        var errors, _i, labels_1, label, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    errors = [];
                    _i = 0, labels_1 = labels;
                    _a.label = 1;
                case 1:
                    if (!(_i < labels_1.length)) return [3 /*break*/, 4];
                    label = labels_1[_i];
                    return [4 /*yield*/, setImapLabel(account, messageId, label)];
                case 2:
                    result = _a.sent();
                    if (!result.success && result.error) {
                        errors.push("".concat(label, ": ").concat(result.error));
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, {
                        success: errors.length === 0,
                        errors: errors.length > 0 ? errors : undefined
                    }];
            }
        });
    });
}
/**
 * Syncs AI-generated label to IMAP mailbox
 * @param account - IMAP account credentials
 * @param messageId - Email Message-ID
 * @param aiLabel - Label suggested by AI (e.g., "Invoice", "Meeting", "Support")
 * @returns Success status
 */
function syncAILabelToImap(account, messageId, aiLabel) {
    return __awaiter(this, void 0, void 0, function () {
        var labelWithPrefix;
        return __generator(this, function (_a) {
            if (!aiLabel || aiLabel === 'Uncategorized') {
                return [2 /*return*/, { success: true }]; // Skip uncategorized labels
            }
            labelWithPrefix = aiLabel;
            return [2 /*return*/, setImapLabel(account, messageId, labelWithPrefix)];
        });
    });
}
/**
 * Initialize default system labels in Gmail/Outlook mailbox
 * Creates Escalation, Urgent, and MOM labels/folders
 * @param account - IMAP account credentials
 * @returns Success status with created labels
 */
function initializeSystemLabelsInMailbox(account) {
    return __awaiter(this, void 0, void 0, function () {
        var client, created, errors, systemLabels, isGmail, _loop_1, _i, systemLabels_1, labelName, error_4, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = null;
                    created = [];
                    errors = [];
                    systemLabels = ['Escalation', 'Urgent', 'MOM'];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 13]);
                    return [4 /*yield*/, createImapClient(account)];
                case 2:
                    client = _a.sent();
                    isGmail = account.imap_host.includes('gmail');
                    _loop_1 = function (labelName) {
                        var labelExists, list, e_5, error_5;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 8, , 9]);
                                    labelExists = false;
                                    _b.label = 1;
                                case 1:
                                    _b.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, client.list()];
                                case 2:
                                    list = _b.sent();
                                    labelExists = list.some(function (box) { return box.path === labelName; });
                                    return [3 /*break*/, 4];
                                case 3:
                                    e_5 = _b.sent();
                                    labelExists = false;
                                    return [3 /*break*/, 4];
                                case 4:
                                    if (!!labelExists) return [3 /*break*/, 6];
                                    return [4 /*yield*/, client.mailboxCreate(labelName)];
                                case 5:
                                    _b.sent();
                                    created.push(labelName);
                                    console.log("\u2713 Created ".concat(isGmail ? 'Gmail label' : 'IMAP folder', ": ").concat(labelName));
                                    return [3 /*break*/, 7];
                                case 6:
                                    console.log("\u2192 ".concat(isGmail ? 'Gmail label' : 'IMAP folder', " already exists: ").concat(labelName));
                                    _b.label = 7;
                                case 7: return [3 /*break*/, 9];
                                case 8:
                                    error_5 = _b.sent();
                                    console.warn("Failed to create ".concat(labelName, ": ").concat(error_5.message));
                                    errors.push("".concat(labelName, ": ").concat(error_5.message));
                                    return [3 /*break*/, 9];
                                case 9: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, systemLabels_1 = systemLabels;
                    _a.label = 3;
                case 3:
                    if (!(_i < systemLabels_1.length)) return [3 /*break*/, 6];
                    labelName = systemLabels_1[_i];
                    return [5 /*yield**/, _loop_1(labelName)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [4 /*yield*/, client.logout()];
                case 7:
                    _a.sent();
                    return [2 /*return*/, {
                            success: errors.length === 0,
                            created: created,
                            errors: errors.length > 0 ? errors : undefined
                        }];
                case 8:
                    error_4 = _a.sent();
                    if (!client) return [3 /*break*/, 12];
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, client.logout()];
                case 10:
                    _a.sent();
                    return [3 /*break*/, 12];
                case 11:
                    e_4 = _a.sent();
                    return [3 /*break*/, 12];
                case 12:
                    console.error('Error initializing system labels in mailbox:', error_4.message);
                    return [2 /*return*/, {
                            success: false,
                            created: created,
                            errors: [error_4.message]
                        }];
                case 13: return [2 /*return*/];
            }
        });
    });
}
