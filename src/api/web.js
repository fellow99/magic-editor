/**
 * magic-api 2.2.2 端点适配层
 *
 * 每个 EP-* 对应一个命名导出，函数签名贴语义而非贴 URL；本层集中处理
 * URL/method/参数名映射/ROT13 编码/Content-Type；全部返回 request.send(...)
 * 的 HttpResponse 链式对象，组件层继续 .success(...).exception(...).end(...)。
 *
 * 命名严格对齐 plan.md §3.2 函数清单；切勿引入 alias 以保持单一来源。
 */

import request from '@/api/request'
import { rot13b64Encode } from '@/api/codec'

const POST_JSON = {
    method: 'post',
    headers: { 'Content-Type': 'application/json' }
}
const POST_FORM = { method: 'post' }
const GET = { method: 'get' }
const POST_TEXT = {
    method: 'post',
    headers: { 'Content-Type': 'text/plain' }
}

const FOLDER_SET = new Set(['api', 'function', 'datasource', 'task', 'component'])

function postJson(url, body) {
    return request.send(url, JSON.stringify(body), POST_JSON)
}

/**
 * 资源树缓存：loadResourceTree() 命中后写入；invalidateResourceTree() 清空。
 * 写操作（save/copy/delete/move/lock/unlock/upload/push）不在本层强制失效 ——
 * 由组件层在保存成功回调中显式调用 loadResourceTree(true) 强刷，
 * 以保留 plan §3.4 的「调用方决定何时强刷」约定。
 */
let _treeCache = null

/**
 * 把已缓存的 data 包装成 HttpResponse 风格对象。
 *
 * 使用 Promise.resolve().then(...) 在微任务中派发，让调用方有机会先把
 * .success / .end 链上去再触发回调，时序与真实网络请求一致。
 */
function wrapAsHttpResponse(data) {
    const wrapper = {
        successHandle: null,
        exceptionHandle: null,
        errorHandle: null,
        endHandle: null,
        success(handle) {
            this.successHandle = handle
            return this
        },
        exception(handle) {
            this.exceptionHandle = handle
            return this
        },
        error(handle) {
            this.errorHandle = handle
            return this
        },
        end(handle) {
            this.endHandle = handle
            return this
        }
    }
    Promise.resolve().then(() => {
        try {
            if (typeof wrapper.successHandle === 'function') {
                wrapper.successHandle(data, null)
            }
        } finally {
            if (typeof wrapper.endHandle === 'function') {
                wrapper.endHandle(true)
            }
        }
    })
    return wrapper
}

/**
 * EP-RES-001 加载资源树（替代 1.x 五个 list 端点）。
 *
 * 缓存写入通过劫持返回对象的 success 方法实现：调用方 .success(handler) 注册的 handler
 * 仍按原序执行，缓存写入只是嵌在它前面的副作用，因此不会被调用方覆盖。
 *
 * @param {boolean} [force=false] 强制重发请求并刷新缓存。
 */
export function loadResourceTree(force = false) {
    if (!force && _treeCache) {
        return wrapAsHttpResponse(_treeCache)
    }
    const httpResponse = request.send('/resource', null, POST_FORM)
    const originalSuccess = httpResponse.success.bind(httpResponse)
    httpResponse.success = function (handle) {
        return originalSuccess(function (data, response) {
            _treeCache = data
            if (typeof handle === 'function') {
                handle(data, response)
            }
        })
    }
    originalSuccess(function (data) { _treeCache = data })
    return httpResponse
}

export function getFolderTree(folder) {
    return _treeCache ? _treeCache[folder] : undefined
}

export function invalidateResourceTree() {
    _treeCache = null
}

/**
 * EP-RES-002 保存分组（2.2.2 起 create/update 合并为单端点）。
 *
 * 字段白名单与 1.x utils.requestGroup 保持一致，避免把 children/treeNode 等
 * UI 侧增补字段误传给后端。
 */
export function saveFolder(group) {
    const body = {
        id: group.id,
        name: group.name,
        path: group.path,
        type: group.type,
        paths: group.paths,
        options: group.options,
        parentId: group.parentId
    }
    return postJson('/resource/folder/save', body)
}

export function copyFolder(src, target) {
    return request.send('/resource/folder/copy', { src, target }, POST_FORM)
}

/**
 * EP-RES-004 保存文件（API/Function/DataSource/Task/Component）。
 *
 * body = ROT13(Base64(JSON.stringify(entity)))，Content-Type: text/plain。
 * folder 白名单校验：避免组件层错传 'group' / 'apis' 等导致后端 404。
 */
export function saveFile(folder, entity) {
    if (!FOLDER_SET.has(folder)) {
        throw new Error(`saveFile: invalid folder "${folder}"; expected one of ${[...FOLDER_SET].join(', ')}`)
    }
    const body = rot13b64Encode(JSON.stringify(entity))
    return request.send(`/resource/file/${folder}/save`, body, POST_TEXT)
}

export function getFile(id) {
    return request.send(`/resource/file/${id}`, null, GET)
}

export function deleteResource(id) {
    return request.send('/resource/delete', { id }, POST_FORM)
}

/**
 * EP-RES-007 移动文件到分组。
 * 调用方语义参数名 srcId；内部映射到后端要求的 src。
 */
export function moveResource(srcId, groupId) {
    return request.send('/resource/move', { src: srcId, groupId }, POST_FORM)
}

export function lockFile(id) {
    return request.send('/resource/lock', { id }, POST_FORM)
}

export function unlockFile(id) {
    return request.send('/resource/unlock', { id }, POST_FORM)
}

export function listBackupsByTime(timestamp) {
    return request.send('/backups', timestamp != null ? { timestamp } : null, GET)
}

export function listBackupsById(id) {
    return request.send(`/backup/${id}`, null, GET)
}

export function getBackupContent(timestamp, id) {
    return request.send('/backup', { timestamp, id }, GET)
}

export function rollbackBackup(id, timestamp) {
    return request.send('/backup/rollback', { id, timestamp }, POST_FORM)
}

export function fullBackup() {
    return request.send('/backup/full', null, POST_FORM)
}

/**
 * EP-DS-001 JDBC 连通性测试。
 * 后端 @RequestBody DataSourceInfo —— 必须 JSON body，
 * 由 src/api/request.js 的 transformRequest 字符串旁路保证不被 Qs.stringify。
 */
export function testDatasource(dsInfo) {
    return postJson('/datasource/jdbc/test', dsInfo)
}

export function getConfig() {
    return request.send('/config.json', null, GET)
}

export function getClassesText() {
    return request.send('/classes.txt', null, GET)
}

export function getClasses() {
    return request.send('/classes', null, POST_FORM)
}

export function getClass(className) {
    return request.send('/class', { className }, POST_FORM)
}

export function login(username, password) {
    return request.send('/login', { username, password }, POST_FORM)
}

export function currentUser() {
    return request.send('/user', null, POST_FORM)
}

export function logout() {
    return request.send('/logout', null, POST_FORM)
}

export function listPlugins() {
    return request.send('/plugins', null, GET)
}

export function listOptions() {
    return request.send('/options', null, POST_FORM)
}

export function reload() {
    return request.send('/reload', null, GET)
}

export function searchScript(keyword) {
    return request.send('/search', { keyword }, POST_FORM)
}

/** EP-WB-012 TODO/FIXME 注释扫描；2.2.2 起方法切为 GET。 */
export function listTodo() {
    return request.send('/todo', null, GET)
}

export function getConfigJs() {
    return request.send('/config-js', null, GET)
}

/**
 * EP-WB-014 导出 zip。
 * query: groupId；body: 可选 SelectedResource[] JSON；响应: blob。
 */
export function download(groupId, selected) {
    return request.send('/download', selected ? JSON.stringify(selected) : null, {
        method: 'post',
        params: { groupId },
        headers: { 'Content-Type': 'application/json' },
        responseType: 'blob'
    })
}

/**
 * EP-WB-015 导入 zip。
 * 调用方传裸 File + mode 字符串；本函数负责拼 FormData，
 * 组件层不再需要直接构造 multipart。
 */
export function upload(file, mode) {
    const formData = new FormData()
    formData.append('file', file)
    if (mode != null) {
        formData.append('mode', mode)
    }
    return request.send('/upload', formData, POST_FORM)
}

/**
 * EP-WB-016 推送到目标实例。
 * 调用方以 { target, secretKey, mode } 形式传入 headers，
 * 本函数映射到后端要求的 magic-push-target / magic-push-secret-key / magic-push-mode。
 */
export function push(headers, selected) {
    const { target, secretKey, mode } = headers || {}
    return request.send('/push', JSON.stringify(selected), {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'magic-push-target': target,
            'magic-push-secret-key': secretKey,
            'magic-push-mode': mode
        }
    })
}

export default {
    loadResourceTree, getFolderTree, invalidateResourceTree,
    saveFolder, copyFolder,
    saveFile, getFile,
    deleteResource, moveResource, lockFile, unlockFile,
    listBackupsByTime, listBackupsById, getBackupContent, rollbackBackup, fullBackup,
    testDatasource,
    getConfig, getClassesText, getClasses, getClass,
    login, currentUser, logout,
    listPlugins, listOptions, reload, searchScript, listTodo,
    getConfigJs, download, upload, push
}
