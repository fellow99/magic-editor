/**
 * 获取 context menu 的挂载目标，优先挂载到 .ma-container 下以便继承主题 CSS 变量
 * @returns {HTMLElement}
 */
export function getMountTarget() {
    return document.querySelector('.ma-container') || document.body
}

export function hasClass(el, className) {
    if (!className) {
        return true;
    }
    if (!el || !el.className || typeof el.className !== 'string') {
        return false;
    }
    for (let cn of el.className.split(/\s+/)) {
        if (cn === className) {
            return true;
        }
    }
    return false;
}

export function getElementsByClassName(className) {
    let els = [];
    for (let el of document.getElementsByClassName(className) || []) {
        els.push(el);
    }
    return els;
}


