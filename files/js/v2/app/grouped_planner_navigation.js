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
        trigger.setAttribute("title", "Режимы проекта");
        trigger.setAttribute("aria-label", "Режимы проекта: " + itemName(current));
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

    function createSearch() {
        var field = document.createElement("input"), results = document.createElement("div");
        var search = document.createElement("div"), status = document.createElement("div");
        search.className = "planner-project-search";
        field.type = "search"; field.id = "planner-project-search";
        field.placeholder = "Найти режим или инструмент…"; field.setAttribute("aria-label", "Поиск режимов и инструментов");
        field.setAttribute("role", "combobox"); field.setAttribute("aria-autocomplete", "list");
        field.setAttribute("aria-controls", "planner-project-search-results"); field.setAttribute("aria-expanded", "false");
        results.id = "planner-project-search-results"; results.setAttribute("role", "listbox"); results.hidden = true;
        status.className = "planner-search-status"; status.setAttribute("role", "status");
        search.appendChild(field); search.appendChild(status); search.appendChild(results);
        wrapper.insertBefore(search, navigation);
        var matches = [], index = -1, guide, guideTarget, guideTimer, revealVersion = 0;
        function normalized(text) { return text.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim(); }
        function available(node) { return !node.hidden && node.style.display !== "none" && !node.classList.contains("forbidden"); }
        function catalog() {
            var entries = [], plans = {};
            navigation.querySelectorAll(".groups_navi_item[data-plan]").forEach(function (node) {
                if (!available(node) || node.classList.contains("add")) return;
                plans[itemPlan(node)] = node;
                entries.push({name:itemName(node), path:"Режим проекта", node:node, mode:node});
            });
            document.querySelectorAll("#planner_ui_tools .tools_item, #planner_ui_tools .tools_more_item, .planner_ui_subtools .subtools_item:not(.group)").forEach(function (node) {
                if (!available(node)) return;
                var root = node, panel = node.closest(".planner_ui_subtools");
                if (panel) root = Array.prototype.find.call(document.querySelectorAll("#planner_ui_tools .tools_item[data-target]"), function (candidate) {
                    return candidate.getAttribute("data-target") === panel.getAttribute("data-parent");
                });
                if (!root) return;
                Array.prototype.forEach.call(root.classList, function (name) {
                    if (name.indexOf("show_on_") !== 0) return;
                    var mode = plans[name.slice(8)]; if (!mode) return;
                    entries.push({name:itemName(node), path:itemName(mode)+(panel ? " › "+itemName(root) : ""), node:node, mode:mode, panel:panel});
                });
            });
            return entries;
        }
        function clearGuide() {
            if (guideTarget) guideTarget.classList.remove("planner-search-found");
            if (guide) guide.remove(); guide = guideTarget = null;
            clearTimeout(guideTimer);
        }
        function positionGuide() {
            if (!guide || !guideTarget) return;
            var rect = guideTarget.getBoundingClientRect();
            if (!rect.width || !rect.height) { clearGuide(); return; }
            var right = rect.right + 14 + guide.offsetWidth < window.innerWidth;
            guide.classList.toggle("points-right", !right);
            guide.style.left = Math.max(8, right ? rect.right + 14 : rect.left - guide.offsetWidth - 14) + "px";
            guide.style.top = Math.max(8, Math.min(window.innerHeight-guide.offsetHeight-8, rect.top+rect.height/2-guide.offsetHeight/2)) + "px";
        }
        function pointTo(node, name) {
            clearGuide(); guideTarget = node; node.classList.add("planner-search-found");
            node.scrollIntoView({block:"nearest", inline:"nearest"});
            guide = document.createElement("div"); guide.className = "planner-search-guide";
            guide.textContent = name; guide.setAttribute("role", "status"); document.body.appendChild(guide);
            positionGuide(); guideTimer = setTimeout(clearGuide, 10000);
        }
        function reveal(entry) {
            var version = ++revealVersion;
            clearGuide(); setOpen(false); field.value = ""; update();
            if (typeof window.close_subtools_wrapper === "function") close_subtools_wrapper();
            // Use the same mode transition as a manual choice. Finding a tool does not activate construction.
            entry.mode.click();
            var attempt = 0;
            function locate() {
                if (version !== revealVersion) return;
                if (!entry.panel) {
                    var toolsWrapper = document.getElementById("planner_ui_tools_wrapper"), toolsPanel = document.getElementById("planner_ui_tools");
                    if (toolsWrapper && toolsPanel) toolsWrapper.style.width = toolsPanel.offsetWidth + "px";
                }
                if (entry.panel && typeof window.open_subtools_wrapper === "function") {
                    open_subtools_wrapper(entry.panel.getAttribute("data-parent"));
                    var group = entry.node.closest(".subtools_group"); if (group) group.classList.add("active");
                }
                if (entry.node === entry.mode) { pointTo(trigger, entry.name); return; }
                if (entry.node.getClientRects().length && entry.node.getBoundingClientRect().width) {
                    pointTo(entry.node, entry.name); return;
                }
                if (++attempt < 20) setTimeout(locate, 100);
                else { setOpen(true); field.value = entry.name; update(); status.textContent = "Инструмент недоступен в текущем состоянии проекта."; }
            }
            setTimeout(locate, 100);
        }
        function selectIndex(next) {
            index = next;
            Array.prototype.forEach.call(results.children, function (button, i) { button.setAttribute("aria-selected", String(i === index)); });
            if (index >= 0 && results.children[index]) {
                field.setAttribute("aria-activedescendant", results.children[index].id);
                results.children[index].scrollIntoView({block:"nearest"});
            } else field.removeAttribute("aria-activedescendant");
        }
        function update() {
            var query = normalized(field.value), words = query.split(" ");
            results.replaceChildren(); index = -1;
            if (!query) {
                matches = []; results.hidden = true; navigation.hidden = false; status.textContent = "";
                field.setAttribute("aria-expanded", "false"); field.removeAttribute("aria-activedescendant"); return;
            }
            matches = catalog().filter(function (entry) {
                return words.every(function (word) { return normalized(entry.name+" "+entry.path).indexOf(word) !== -1; });
            }).sort(function (a,b) {
                function rank(entry) { var name = normalized(entry.name); return name === query ? 0 : name.indexOf(query) === 0 ? 1 : 2; }
                return rank(a)-rank(b) || a.name.localeCompare(b.name,"ru");
            });
            status.textContent = matches.length ? "Найдено: "+matches.length+". Выберите результат, чтобы показать его в редакторе." : "Ничего не найдено";
            matches = matches.slice(0, 80);
            matches.forEach(function (entry, i) {
                var button = document.createElement("button"), name = document.createElement("strong"), path = document.createElement("small");
                button.type = "button"; button.id = "planner-search-result-"+i; button.setAttribute("role", "option"); button.tabIndex = -1;
                name.textContent = entry.name; path.textContent = entry.path; button.appendChild(name); button.appendChild(path);
                button.addEventListener("click", function (event) { event.stopPropagation(); reveal(entry); }); results.appendChild(button);
            });
            results.hidden = false; navigation.hidden = true; field.setAttribute("aria-expanded", "true"); selectIndex(matches.length ? 0 : -1);
        }
        field.addEventListener("input", update);
        ["mousedown", "click", "keyup"].forEach(function (name) { field.addEventListener(name, function (e) { e.stopPropagation(); }); });
        field.addEventListener("keydown", function (event) {
            event.stopPropagation();
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault(); if (matches.length) selectIndex((index+(event.key === "ArrowDown" ? 1 : matches.length-1)) % matches.length);
            } else if (event.key === "Enter") { event.preventDefault(); if (matches[index]) reveal(matches[index]); }
            else if (event.key === "Escape") { event.preventDefault(); if (field.value) { field.value = ""; update(); } else { setOpen(false); trigger.focus(); } }
        });
        document.addEventListener("keydown", function (event) { if (event.key === "Escape") { ++revealVersion; clearGuide(); } });
        document.addEventListener("pointerdown", function (event) { if (guide && !guide.contains(event.target)) { ++revealVersion; clearGuide(); } }, true);
        window.addEventListener("resize", positionGuide);
        document.addEventListener("scroll", positionGuide, true);
        trigger.addEventListener("click", function () { if (wrapper.classList.contains("open")) field.focus(); });
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
        createSearch();
        syncCurrent();

        if (typeof window.init_navi_bar === "function") window.init_navi_bar();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
}());
