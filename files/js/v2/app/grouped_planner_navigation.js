(function () {
    "use strict";

    var GROUPS = [
        { id: "layout", title: "Планировка", plans: ["init", "break_walls", "create_walls", "rooms", "projections"] },
        { id: "equipment", title: "Оснащение", plans: ["furniture", "santeh", "radiators"] },
        { id: "electric", title: "Электрика", plans: ["sockets", "light_connections", "light", "cables", "shield"] },
        { id: "systems", title: "Климат и системы", plans: ["waterplan", "warm_floor", "conditioners", "ventilation", "security"] },
        { id: "finishing", title: "Отделка", plans: ["floor", "walls", "ceiling", "shtukaturka", "styazhka", "hydroisolation", "isolation"] },
        { id: "custom", title: "Пользовательские этапы", plans: [] }
    ];

    var ICONS = {
        init: "⌂",
        break_walls: "⌫",
        create_walls: "▥",
        rooms: "▦",
        projections: "▤",
        furniture: "▰",
        santeh: "◉",
        radiators: "≋",
        sockets: "⊙",
        light_connections: "⌁",
        light: "☼",
        cables: "⌇",
        shield: "▣",
        waterplan: "≈",
        warm_floor: "≋",
        conditioners: "❄",
        ventilation: "◌",
        security: "◇",
        floor: "▤",
        walls: "▥",
        ceiling: "⌃",
        shtukaturka: "▧",
        styazhka: "▬",
        hydroisolation: "◒",
        isolation: "▦"
    };

    var wrapper;
    var navigation;
    var selector;
    var trigger;
    var triggerIcon;
    var triggerLabel;
    var groupNodes = {};
    var groupSections = {};
    var organizing = false;
    var observer;

    function itemPlan(item) {
        return item.getAttribute("data-plan") || "";
    }

    function itemName(item) {
        var text = "";
        Array.prototype.forEach.call(item.childNodes, function (node) {
            if (node.nodeType === 3) text += node.nodeValue;
        });
        return text.trim() || item.getAttribute("title") || "Этап проекта";
    }

    function iconClass(item) {
        var classes = Array.prototype.slice.call(item.classList);
        for (var i = 0; i < classes.length; i++) {
            if (classes[i].indexOf("plan_") === 0) return classes[i];
        }
        if (itemPlan(item) === "projections") return "plan_projections";
        if (item.classList.contains("custom")) return "custom";
        if (item.classList.contains("add")) return "add";
        return "plan_init";
    }

    function iconSymbol(item) {
        if (item.classList.contains("add")) return "+";
        if (item.classList.contains("custom")) return "✦";
        return ICONS[itemPlan(item)] || "•";
    }

    function ensureItemIcon(item) {
        var icon = item.querySelector(":scope > .planner-nav-item-icon");
        if (!icon) {
            icon = document.createElement("span");
            icon.className = "planner-nav-item-icon";
            icon.setAttribute("aria-hidden", "true");
            item.insertBefore(icon, item.firstChild);
        }
        icon.textContent = iconSymbol(item);
    }

    function targetGroup(item) {
        if (item.classList.contains("custom") || item.classList.contains("add")) return "custom";
        var plan = itemPlan(item);
        for (var i = 0; i < GROUPS.length; i++) {
            if (GROUPS[i].plans.indexOf(plan) !== -1) return GROUPS[i].id;
        }
        return "custom";
    }

    function createGroups() {
        GROUPS.forEach(function (group) {
            var section = document.createElement("section");
            section.className = "planner-nav-group planner-nav-group-" + group.id;
            section.setAttribute("data-navigation-group", group.id);

            var title = document.createElement("h3");
            title.className = "planner-nav-group-title";
            title.textContent = group.title;
            section.appendChild(title);

            var items = document.createElement("div");
            items.className = "planner-nav-group-items";
            section.appendChild(items);

            groupNodes[group.id] = items;
            groupSections[group.id] = section;
            navigation.appendChild(section);
        });
    }

    function itemOrder(item) {
        var groupId = targetGroup(item);
        for (var i = 0; i < GROUPS.length; i++) {
            if (GROUPS[i].id !== groupId) continue;
            var order = GROUPS[i].plans.indexOf(itemPlan(item));
            return order === -1 ? 100 : order;
        }
        return 100;
    }

    function updateEmptyGroups() {
        GROUPS.forEach(function (group) {
            groupSections[group.id].classList.toggle("is-empty", groupNodes[group.id].children.length === 0);
        });
    }

    function organizeItems() {
        if (organizing) return;
        organizing = true;

        Array.prototype.slice.call(navigation.querySelectorAll(".groups_navi_item")).forEach(function (item) {
            var group = groupNodes[targetGroup(item)] || groupNodes.custom;
            if (item.parentNode !== group) group.appendChild(item);
            item.style.order = itemOrder(item);
            ensureItemIcon(item);
            if (itemPlan(item) === "projections" && !iconClass(item).match(/^plan_/)) {
                item.classList.add("plan_projections");
            } else if (itemPlan(item) === "projections" && !Array.prototype.slice.call(item.classList).some(function (name) {
                return name === "plan_projections";
            })) {
                item.classList.add("plan_projections");
            }
        });

        updateEmptyGroups();
        organizing = false;
        syncCurrent();
    }

    function currentItem() {
        var active = Array.prototype.slice.call(navigation.querySelectorAll(".groups_navi_item.active"));
        for (var i = 0; i < active.length; i++) {
            if (active[i].offsetParent !== null) return active[i];
        }
        var items = Array.prototype.slice.call(navigation.querySelectorAll(".groups_navi_item"));
        for (var j = 0; j < items.length; j++) {
            if (items[j].offsetParent !== null && !items[j].classList.contains("add")) return items[j];
        }
        return null;
    }

    function syncCurrent() {
        if (!trigger) return;
        var current = currentItem();
        if (!current) return;

        triggerLabel.textContent = itemName(current);
        trigger.setAttribute("title", itemName(current));
        triggerIcon.className = "planner-nav-trigger-icon " + iconClass(current);
        triggerIcon.textContent = iconSymbol(current);
    }

    function setOpen(open) {
        wrapper.classList.toggle("open", open);
        wrapper.setAttribute("aria-hidden", open ? "false" : "true");
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function createSelector() {
        selector = document.createElement("div");
        selector.className = "planner_ui_function planner-nav-selector";

        trigger = document.createElement("button");
        trigger.className = "planner-nav-trigger";
        trigger.type = "button";
        trigger.setAttribute("aria-haspopup", "true");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", "groups_navi_wrapper");

        triggerIcon = document.createElement("span");
        triggerIcon.className = "planner-nav-trigger-icon plan_init";
        triggerIcon.setAttribute("aria-hidden", "true");

        triggerLabel = document.createElement("span");
        triggerLabel.className = "planner-nav-trigger-label";
        triggerLabel.textContent = "Исходный план";

        trigger.appendChild(triggerIcon);
        trigger.appendChild(triggerLabel);
        selector.appendChild(trigger);

        var printButton = document.querySelector("#planner_ui_functions .planner_ui_function.print");
        var functions = document.getElementById("planner_ui_functions");
        if (printButton && printButton.parentNode) {
            printButton.parentNode.insertBefore(selector, printButton.nextSibling);
        } else {
            functions.appendChild(selector);
        }

        document.body.appendChild(wrapper);
    }

    function bindEvents() {
        trigger.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(!wrapper.classList.contains("open"));
        });

        wrapper.addEventListener("click", function (event) {
            if (event.target.closest(".groups_navi_item")) {
                setTimeout(function () {
                    syncCurrent();
                    setOpen(false);
                }, 0);
            }
        });

        document.addEventListener("click", function (event) {
            if (wrapper.classList.contains("open") && !selector.contains(event.target) && !wrapper.contains(event.target)) {
                setOpen(false);
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && wrapper.classList.contains("open")) {
                setOpen(false);
                trigger.focus();
            }
        });

        observer = new MutationObserver(function (mutations) {
            var needsOrganizing = mutations.some(function (mutation) {
                return mutation.type === "childList" && Array.prototype.some.call(mutation.addedNodes, function (node) {
                    return node.nodeType === 1 && (node.matches(".groups_navi_item") || node.querySelector(".groups_navi_item"));
                });
            });
            if (needsOrganizing) organizeItems();
            else syncCurrent();
        });
        observer.observe(navigation, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    }

    function init() {
        wrapper = document.getElementById("groups_navi_wrapper");
        navigation = document.getElementById("groups_navi");
        if (!wrapper || !navigation || !document.getElementById("planner_ui_functions")) return;

        wrapper.classList.add("planner-nav-dropdown", "planner-nav-ready");
        wrapper.setAttribute("aria-hidden", "true");
        createSelector();

        var existingItems = Array.prototype.slice.call(navigation.querySelectorAll(":scope > .groups_navi_item"));
        createGroups();
        existingItems.forEach(function (item) {
            (groupNodes[targetGroup(item)] || groupNodes.custom).appendChild(item);
            item.style.order = itemOrder(item);
            ensureItemIcon(item);
            if (itemPlan(item) === "projections") item.classList.add("plan_projections");
        });

        updateEmptyGroups();

        bindEvents();
        syncCurrent();

        if (typeof window.init_navi_bar === "function") window.init_navi_bar();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
}());
