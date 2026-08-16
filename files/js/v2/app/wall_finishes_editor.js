(function () {
    "use strict";

    var STORAGE_VERSION = 1;
    var STORAGE_PREFIX = "remplanner.wall-finishes.v1.";
    var SVG_NS = "http://www.w3.org/2000/svg";
    var EXCLUDED = "__excluded";
    var MATERIALS = [
        { id: "none", name: "Материал не задан", color: "#ffffff" },
        { id: "wallpaper", name: "Обои", color: "#b59776" },
        { id: "paint_wall", name: "Покраска стен", color: "#668ee0" },
        { id: "wall_chalk_paint", name: "Меловая краска", color: "#383838" },
        { id: "wall_tile", name: "Облицовка плиткой", color: "#eed500" },
        { id: "wall_mosaic", name: "Мозаика", color: "#7486df" },
        { id: "wall_clinker", name: "Клинкерный кирпич", color: "#ec5900" },
        { id: "wall_stone", name: "Натуральный камень", color: "#9a866f" },
        { id: "wall_wooden_panels", name: "Деревянная вагонка", color: "#d7c000" },
        { id: "plastic_panels", name: "Реечные панели", color: "#ce8f4c" },
        { id: "wall_woodbatten", name: "Декоративные рейки", color: "#8d5e50" },
        { id: "wall_sheet_panels", name: "Листовые панели", color: "#32bb33" },
        { id: "wall_tile_panels", name: "Плиточные панели", color: "#00e1de" },
        { id: "decorative_plaster", name: "Фактурная штукатурка", color: "#ff4b75" },
        { id: "venice_plaster", name: "Венецианская штукатурка", color: "#ec5900" }
    ];

    var state = { version: STORAGE_VERSION, rooms: {} };
    var walls = [];
    var selectedWall = 0;
    var wallSignature = "";
    var saveTimer = 0;
    var panel;
    var hint;

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function storageKey() {
        var objectId = document.body && document.body.getAttribute("data-object-id");
        return STORAGE_PREFIX + (objectId && objectId !== "0" ? objectId : location.pathname);
    }

    function loadLocalState() {
        try {
            var stored = JSON.parse(localStorage.getItem(storageKey()));
            if (stored && stored.version === STORAGE_VERSION && stored.rooms) {
                state = stored;
            }
        } catch (error) {
            console.warn("Wall finishes: local data is not available", error);
        }
    }

    function restoreState(data) {
        if (data && data.wall_finishes_editor && data.wall_finishes_editor.rooms) {
            state = clone(data.wall_finishes_editor);
            persistLocally();
        }
    }

    function persistLocally() {
        try {
            localStorage.setItem(storageKey(), JSON.stringify(state));
        } catch (error) {
            console.warn("Wall finishes: cannot save local data", error);
        }
    }

    function appendState(data) {
        if (data && typeof data === "object") {
            data.wall_finishes_editor = clone(state);
        }
        return data;
    }

    function patchPersistence() {
        if (window.project && !window.project.__wallFinishesPatched) {
            window.project.__wallFinishesPatched = true;

            if (typeof window.project.copy === "function") {
                var originalCopy = window.project.copy;
                window.project.copy = function () {
                    return appendState(originalCopy.apply(this, arguments));
                };
            }

            if (typeof window.project.restore_final === "function") {
                var originalRestoreFinal = window.project.restore_final;
                window.project.restore_final = function (data) {
                    restoreState(data);
                    return originalRestoreFinal.apply(this, arguments);
                };
            }
        }

        if (window.$Project && !window.$Project.__wallFinishesPatched) {
            window.$Project.__wallFinishesPatched = true;

            if (typeof window.$Project.localCopy === "function") {
                var originalLocalCopy = window.$Project.localCopy;
                window.$Project.localCopy = function () {
                    return appendState(originalLocalCopy.apply(this, arguments));
                };
            }

            if (typeof window.$Project.restore === "function") {
                var originalProjectRestore = window.$Project.restore;
                window.$Project.restore = function (data) {
                    restoreState(data);
                    return originalProjectRestore.apply(this, arguments);
                };
            }
        }
    }

    function markChanged() {
        persistLocally();
        window.flag_changes = true;
        if (window.project) {
            window.project.need_saving = 1;
        }

        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            if (window.project && typeof window.project.localSave === "function") {
                window.project.localSave();
                window.project.need_saving = 0;
            }
        }, 350);
    }

    function material(id) {
        for (var i = 0; i < MATERIALS.length; i++) {
            if (MATERIALS[i].id === id) return MATERIALS[i];
        }
        if (id === EXCLUDED) return { id: EXCLUDED, name: "Без отделки", color: "#ffffff" };
        return MATERIALS[0];
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatArea(cm2) {
        return (Math.max(0, cm2) / 10000).toFixed(2) + " м²";
    }

    function formatLength(cm) {
        return Math.round(cm) + " см";
    }

    function getRoomId() {
        return window.project && window.project.prs ? String(window.project.prs.room || "") : "";
    }

    function getRoom() {
        var id = getRoomId();
        return id && window.ROOMS2 ? window.ROOMS2[id] : null;
    }

    function getRoomStateKey() {
        var room = getRoom();
        if (!room || !Array.isArray(room.polygon) || !room.polygon.length) return getRoomId();
        var points = room.polygon.map(function (point) {
            return (Math.round(point.x * 10) / 10) + "," + (Math.round(point.y * 10) / 10);
        });
        var variants = [];
        [points, points.slice().reverse()].forEach(function (ordered) {
            for (var i = 0; i < ordered.length; i++) {
                variants.push(ordered.slice(i).concat(ordered.slice(0, i)).join(";"));
            }
        });
        variants.sort();
        return "geometry:" + variants[0];
    }

    function roomData(roomId) {
        if (!state.rooms[roomId]) state.rooms[roomId] = { walls: {} };
        if (!state.rooms[roomId].walls) state.rooms[roomId].walls = {};
        return state.rooms[roomId];
    }

    function wallData(roomId, wallKey) {
        var room = roomData(roomId);
        if (!room.walls[wallKey]) {
            room.walls[wallKey] = { material: "none", zones: [] };
        }
        if (!Array.isArray(room.walls[wallKey].zones)) room.walls[wallKey].zones = [];
        return room.walls[wallKey];
    }

    function isProjectionOpen() {
        var close = document.getElementById("prs_close");
        return window.plan === "walls" && window.plan_ === "projections" && close && close.offsetParent !== null;
    }

    function isWallsPlan() {
        return window.plan === "walls" && window.plan_ !== "projections";
    }

    function findRoomAtEvent(event) {
        if (!window.ROOMS2) return null;

        for (var id in window.ROOMS2) {
            if (!Object.prototype.hasOwnProperty.call(window.ROOMS2, id)) continue;
            var room = window.ROOMS2[id];
            var floorNode = room && room.FLOOR && room.FLOOR.node;
            if (floorNode && (event.target === floorNode || floorNode.contains(event.target))) return room;
        }

        if (!window.LIB || typeof window.LIB.point !== "function" ||
            !isFinite(event.clientX) || !isFinite(event.clientY)) return null;
        var point = window.LIB.point(event.clientX, event.clientY, "svg");
        for (var roomId in window.ROOMS2) {
            if (!Object.prototype.hasOwnProperty.call(window.ROOMS2, roomId)) continue;
            var candidate = window.ROOMS2[roomId];
            if (candidate && candidate.polygon && window.LIB.isPointOverPolygon(point, candidate.polygon)) {
                return candidate;
            }
        }
        return null;
    }

    function openRoomProjection(room) {
        if (!room || !room.PRS) return;
        if (window.project && window.project.prs) window.project.prs.mode = 2;
        room.PRS.get({ force: true });
        room.PRS.draw();
        document.body.classList.add("wall-finishes-projection");
        wallSignature = "";
        setTimeout(sync, 60);
    }

    function onPlannerClick(event) {
        if (!isWallsPlan()) return;
        if (!event.target.closest || !event.target.closest("#main_svg")) return;
        if (window.tool && window.tool !== "none") return;
        var room = findRoomAtEvent(event);
        if (!room || room.role === "terrace") return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openRoomProjection(room);
    }

    function numericAttribute(element, name) {
        return parseFloat(element.getAttribute(name)) || 0;
    }

    function wallBackgrounds() {
        var svg = document.getElementById("main_svg");
        if (!svg) return [];
        return Array.prototype.slice.call(svg.querySelectorAll('rect[stroke="transparent"]')).filter(function (rect) {
            var width = numericAttribute(rect, "width");
            var height = numericAttribute(rect, "height");
            return !rect.hasAttribute("data-wfe-overlay") && width >= 20 && height >= 100 && rect.getAttribute("fill") === "#ffffff";
        }).sort(function (a, b) {
            return numericAttribute(a, "x") - numericAttribute(b, "x");
        });
    }

    function openingRects() {
        var svg = document.getElementById("main_svg");
        if (!svg) return [];
        var candidates = Array.prototype.slice.call(svg.querySelectorAll('rect[fill="#ffffff"][stroke="#404040"]')).filter(function (rect) {
            return numericAttribute(rect, "width") > 20 && numericAttribute(rect, "height") > 40;
        });
        return candidates.filter(function (candidate, index) {
            var box = candidate.getBoundingClientRect();
            return !candidates.some(function (other, otherIndex) {
                if (index === otherIndex) return false;
                var otherBox = other.getBoundingClientRect();
                var contains = otherBox.left <= box.left + 0.5 && otherBox.top <= box.top + 0.5 &&
                    otherBox.right >= box.right - 0.5 && otherBox.bottom >= box.bottom - 0.5;
                var strictlyLarger = otherBox.width * otherBox.height > box.width * box.height + 1;
                return contains && strictlyLarger;
            });
        });
    }

    function intersection(a, b) {
        var left = Math.max(a.x, b.x);
        var bottom = Math.max(a.y, b.y);
        var right = Math.min(a.x + a.width, b.x + b.width);
        var top = Math.min(a.y + a.height, b.y + b.height);
        if (right <= left || top <= bottom) return 0;
        return (right - left) * (top - bottom);
    }

    function getOpeningsForWall(rect, openingElements) {
        var wallBox = rect.getBoundingClientRect();
        var wallWidth = numericAttribute(rect, "width");
        var wallHeight = numericAttribute(rect, "height");
        var scaleX = wallBox.width ? wallWidth / wallBox.width : 1;
        var scaleY = wallBox.height ? wallHeight / wallBox.height : 1;

        return openingElements.map(function (opening) {
            var box = opening.getBoundingClientRect();
            var left = Math.max(box.left, wallBox.left);
            var right = Math.min(box.right, wallBox.right);
            var top = Math.max(box.top, wallBox.top);
            var bottom = Math.min(box.bottom, wallBox.bottom);
            if (right <= left || bottom <= top) return null;
            return {
                x: (left - wallBox.left) * scaleX,
                y: (wallBox.bottom - bottom) * scaleY,
                width: (right - left) * scaleX,
                height: (bottom - top) * scaleY
            };
        }).filter(Boolean);
    }

    function scanWalls() {
        var roomId = getRoomStateKey();
        var room = getRoom();
        var backgrounds = wallBackgrounds();
        var openings = openingRects();
        var lines = room && room.PRS && room.PRS.lines ? room.PRS.lines : [];

        walls = backgrounds.map(function (rect, index) {
            var width = numericAttribute(rect, "width");
            var height = numericAttribute(rect, "height");
            var line = lines[index] || {};
            var key = line.edge_index !== undefined ? "edge:" + line.edge_index :
                "wall:" + index + ":" + Math.round(width * 10) / 10;
            return {
                index: index,
                key: key,
                rect: rect,
                x: numericAttribute(rect, "x"),
                y: numericAttribute(rect, "y"),
                width: width,
                height: height,
                openings: getOpeningsForWall(rect, openings),
                data: wallData(roomId, key)
            };
        });

        if (selectedWall >= walls.length) selectedWall = 0;
    }

    function zoneEffectiveArea(wall, zone) {
        var zoneRect = { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
        var area = zone.width * zone.height;
        for (var i = 0; i < wall.openings.length; i++) {
            area -= intersection(zoneRect, wall.openings[i]);
        }
        return Math.max(0, area);
    }

    function wallMetrics(wall) {
        var gross = wall.width * wall.height;
        var openings = wall.openings.reduce(function (sum, opening) {
            return sum + opening.width * opening.height;
        }, 0);
        var excluded = 0;
        var assignedZones = 0;
        var materialAreas = {};

        wall.data.zones.forEach(function (zone) {
            var area = zoneEffectiveArea(wall, zone);
            assignedZones += area;
            if (zone.material === EXCLUDED) excluded += area;
            else materialAreas[zone.material] = (materialAreas[zone.material] || 0) + area;
        });

        var base = Math.max(0, gross - openings - assignedZones);
        if (wall.data.material && wall.data.material !== "none") {
            materialAreas[wall.data.material] = (materialAreas[wall.data.material] || 0) + base;
        }

        return {
            gross: gross,
            openings: Math.min(gross, openings),
            excluded: excluded,
            available: Math.max(0, gross - openings - excluded),
            assigned: Object.keys(materialAreas).reduce(function (sum, id) { return sum + materialAreas[id]; }, 0),
            materials: materialAreas,
            unassigned: wall.data.material === "none" ? base : 0
        };
    }

    function totalMetrics() {
        var total = { gross: 0, openings: 0, excluded: 0, assigned: 0, unassigned: 0, materials: {} };
        walls.forEach(function (wall) {
            var metrics = wallMetrics(wall);
            total.gross += metrics.gross;
            total.openings += metrics.openings;
            total.excluded += metrics.excluded;
            total.assigned += metrics.assigned;
            total.unassigned += metrics.unassigned;
            Object.keys(metrics.materials).forEach(function (id) {
                total.materials[id] = (total.materials[id] || 0) + metrics.materials[id];
            });
        });
        return total;
    }

    function materialOptions(selected, includeExcluded) {
        var result = includeExcluded ? '<option value="' + EXCLUDED + '">Без отделки</option>' : "";
        MATERIALS.forEach(function (item) {
            if (includeExcluded && item.id === "none") return;
            result += '<option value="' + item.id + '"' + (item.id === selected ? " selected" : "") + '>' + escapeHtml(item.name) + "</option>";
        });
        return result;
    }

    function roomName() {
        var room = getRoom();
        if (!room) return "Комната";
        if (room.name && room.name !== "none") return room.name;
        if (room.zones && room.zones[0] && room.zones[0].name && room.zones[0].name !== "none") return room.zones[0].name;
        return "Комната";
    }

    function render() {
        if (!panel || !isProjectionOpen()) return;
        var selected = walls[selectedWall];
        var totals = totalMetrics();
        var room = escapeHtml(roomName());
        var html = '' +
            '<div class="wfe-header">' +
                '<div class="wfe-title">Отделка стен</div>' +
                '<div class="wfe-room-name">Развертка · ' + room + '</div>' +
                '<button class="wfe-toggle" type="button" title="Свернуть">−</button>' +
            '</div>' +
            '<div class="wfe-body">' +
                '<div class="wfe-summary">' +
                    '<div class="wfe-stat"><span>Площадь стен</span><strong>' + formatArea(totals.gross) + '</strong></div>' +
                    '<div class="wfe-stat"><span>Проёмы</span><strong>− ' + formatArea(totals.openings) + '</strong></div>' +
                    '<div class="wfe-stat"><span>Без отделки</span><strong>− ' + formatArea(totals.excluded) + '</strong></div>' +
                    '<div class="wfe-stat primary"><span>Материалы</span><strong>' + formatArea(totals.assigned) + '</strong></div>' +
                '</div>' +
                '<div class="wfe-section-title">Выберите стену</div>' +
                '<div class="wfe-walls">' + walls.map(function (wall, index) {
                    var metrics = wallMetrics(wall);
                    return '<button class="wfe-wall' + (index === selectedWall ? ' active' : '') + '" data-wall="' + index + '" type="button">' +
                        '<b>Стена ' + (index + 1) + '</b>' +
                        '<span>' + formatLength(wall.width) + ' × ' + formatLength(wall.height) + '</span>' +
                        '<span>' + formatArea(metrics.available) + '</span>' +
                    '</button>';
                }).join("") + '</div>' +
                (selected ? renderWallEditor(selected) : '<div class="wfe-empty">В комнате нет доступных стен.</div>') +
                renderMaterials(totals) +
            '</div>';
        panel.innerHTML = html;
        drawOverlays();
    }

    function renderWallEditor(wall) {
        var zones = wall.data.zones.map(function (zone, index) {
            var item = material(zone.material);
            return '<div class="wfe-zone">' +
                '<span class="wfe-swatch" style="background:' + item.color + '"></span>' +
                '<div><b>' + escapeHtml(item.name) + '</b><br><small>' +
                    formatLength(zone.width) + ' × ' + formatLength(zone.height) + ', от левого края ' + formatLength(zone.x) +
                '</small></div>' +
                '<button class="wfe-delete-zone" data-zone="' + index + '" type="button" title="Удалить">×</button>' +
            '</div>';
        }).join("");

        return '' +
            '<div class="wfe-section-title">Стена ' + (wall.index + 1) + '</div>' +
            '<div class="wfe-field"><label for="wfe-base-material">Основной материал стены</label>' +
                '<select id="wfe-base-material">' + materialOptions(wall.data.material, false) + '</select>' +
            '</div>' +
            '<div class="wfe-section-title">Добавить участок</div>' +
            '<div class="wfe-field"><select id="wfe-zone-material">' + materialOptions(EXCLUDED, true) + '</select></div>' +
            '<div class="wfe-zone-grid">' +
                '<label>Слева, см<input id="wfe-zone-x" type="number" min="0" step="1" value="0"></label>' +
                '<label>От пола, см<input id="wfe-zone-y" type="number" min="0" step="1" value="0"></label>' +
                '<label>Ширина, см<input id="wfe-zone-width" type="number" min="1" step="1" value="100"></label>' +
                '<label>Высота, см<input id="wfe-zone-height" type="number" min="1" step="1" value="60"></label>' +
            '</div>' +
            '<p class="wfe-help">Для зоны за ванной выберите «Без отделки» и задайте её положение и размер.</p>' +
            '<p class="wfe-error" id="wfe-zone-error"></p>' +
            '<button class="wfe-button" id="wfe-add-zone" type="button">Добавить участок</button>' +
            '<div class="wfe-zones">' + (zones || '<div class="wfe-empty">На стене пока нет отдельных участков.</div>') + '</div>';
    }

    function renderMaterials(totals) {
        var rows = Object.keys(totals.materials).sort(function (a, b) {
            return totals.materials[b] - totals.materials[a];
        }).map(function (id) {
            var item = material(id);
            return '<div class="wfe-material-row">' +
                '<span class="wfe-swatch" style="background:' + item.color + '"></span>' +
                '<b>' + escapeHtml(item.name) + '</b>' +
                '<strong>' + formatArea(totals.materials[id]) + '</strong>' +
            '</div>';
        }).join("");
        return '<div class="wfe-section-title">Площадь материалов</div>' +
            '<div class="wfe-materials">' + (rows || '<div class="wfe-empty">Назначьте материал хотя бы одной стене.</div>') + '</div>' +
            (totals.unassigned > 0 ? '<div class="wfe-unassigned">Без назначенного материала: ' + formatArea(totals.unassigned) + '</div>' : '');
    }

    function removeOverlays() {
        Array.prototype.slice.call(document.querySelectorAll("[data-wfe-overlay]")).forEach(function (node) {
            if (node.parentNode) node.parentNode.removeChild(node);
        });
    }

    function addOverlay(wall, x, y, width, height, fill, opacity, options) {
        var rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("data-wfe-overlay", "1");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", Math.max(0, width));
        rect.setAttribute("height", Math.max(0, height));
        rect.setAttribute("fill", fill);
        rect.setAttribute("fill-opacity", opacity);
        rect.setAttribute("pointer-events", "none");
        if (options && options.stroke) {
            rect.setAttribute("stroke", options.stroke);
            rect.setAttribute("stroke-width", options.strokeWidth || 1.5);
            if (options.dash) rect.setAttribute("stroke-dasharray", options.dash);
        }
        wall.rect.parentNode.insertBefore(rect, wall.rect.nextSibling);
    }

    function drawOverlays() {
        removeOverlays();
        walls.forEach(function (wall, index) {
            var base = material(wall.data.material);
            if (wall.data.material !== "none") {
                addOverlay(wall, wall.x, wall.y, wall.width, wall.height, base.color, 0.2);
            }
            wall.data.zones.forEach(function (zone) {
                var item = material(zone.material);
                var y = wall.y + wall.height - zone.y - zone.height;
                addOverlay(wall, wall.x + zone.x, y, zone.width, zone.height,
                    zone.material === EXCLUDED ? "#ffffff" : item.color,
                    zone.material === EXCLUDED ? 0.72 : 0.46,
                    zone.material === EXCLUDED ? { stroke: "#cc0000", dash: "6 4" } : { stroke: item.color });
            });
            if (index === selectedWall) {
                addOverlay(wall, wall.x, wall.y, wall.width, wall.height, "none", 0, { stroke: "#e68506", strokeWidth: 3 });
            }
        });
    }

    function showZoneError(message) {
        var error = document.getElementById("wfe-zone-error");
        if (!error) return;
        error.textContent = message;
        error.classList.toggle("active", Boolean(message));
    }

    function readZone() {
        return {
            material: document.getElementById("wfe-zone-material").value,
            x: parseFloat(document.getElementById("wfe-zone-x").value),
            y: parseFloat(document.getElementById("wfe-zone-y").value),
            width: parseFloat(document.getElementById("wfe-zone-width").value),
            height: parseFloat(document.getElementById("wfe-zone-height").value)
        };
    }

    function zonesOverlap(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    function addZone() {
        var wall = walls[selectedWall];
        if (!wall) return;
        var zone = readZone();
        if ([zone.x, zone.y, zone.width, zone.height].some(function (value) { return !isFinite(value); })) {
            showZoneError("Заполните все размеры участка.");
            return;
        }
        if (zone.x < 0 || zone.y < 0 || zone.width <= 0 || zone.height <= 0) {
            showZoneError("Размеры должны быть больше нуля, отступы — не меньше нуля.");
            return;
        }
        if (zone.x + zone.width > wall.width + 0.01 || zone.y + zone.height > wall.height + 0.01) {
            showZoneError("Участок выходит за границы выбранной стены.");
            return;
        }
        if (wall.data.zones.some(function (existing) { return zonesOverlap(zone, existing); })) {
            showZoneError("Участки на одной стене не должны пересекаться.");
            return;
        }
        wall.data.zones.push(zone);
        markChanged();
        render();
    }

    function onPanelClick(event) {
        var wallButton = event.target.closest("[data-wall]");
        if (wallButton) {
            selectedWall = parseInt(wallButton.getAttribute("data-wall"), 10) || 0;
            render();
            return;
        }
        if (event.target.closest(".wfe-toggle")) {
            panel.classList.toggle("collapsed");
            var button = panel.querySelector(".wfe-toggle");
            if (button) button.textContent = panel.classList.contains("collapsed") ? "+" : "−";
            return;
        }
        if (event.target.closest("#wfe-add-zone")) {
            addZone();
            return;
        }
        var deleteButton = event.target.closest("[data-zone]");
        if (deleteButton && walls[selectedWall]) {
            var index = parseInt(deleteButton.getAttribute("data-zone"), 10);
            walls[selectedWall].data.zones.splice(index, 1);
            markChanged();
            render();
        }
    }

    function onPanelChange(event) {
        if (event.target.id === "wfe-base-material" && walls[selectedWall]) {
            walls[selectedWall].data.material = event.target.value;
            markChanged();
            // Let the native select finish its change interaction before the
            // panel is rebuilt with the recalculated totals.
            setTimeout(render, 80);
        }
    }

    function createInterface() {
        hint = document.createElement("div");
        hint.id = "wall-finishes-entry-hint";
        hint.innerHTML = '<strong>Выберите комнату</strong>, чтобы открыть развертку и отредактировать материалы стен';
        document.body.appendChild(hint);

        panel = document.createElement("aside");
        panel.id = "wall-finishes-editor";
        panel.setAttribute("aria-label", "Редактор отделки стен");
        panel.addEventListener("click", onPanelClick);
        panel.addEventListener("change", onPanelChange);
        document.body.appendChild(panel);

        // The planner can replace the SVG root while switching tabs, so the
        // stable document-level listener is intentional here.
        document.addEventListener("click", onPlannerClick, true);
    }

    function expandProjectionMaterials() {
        if (!window.$DecorLining || !window.$DecorLining.tools_allow_prs) return;
        var ids = MATERIALS.map(function (item) { return item.id; }).filter(function (id) { return id !== "none"; });
        ids.forEach(function (id) {
            if (window.$DecorLining.tools_allow_prs.indexOf(id) === -1) {
                window.$DecorLining.tools_allow_prs.push(id);
            }
        });
    }

    function sync() {
        patchPersistence();
        expandProjectionMaterials();
        var projectionOpen = isProjectionOpen();
        hint.classList.toggle("active", isWallsPlan());
        panel.classList.toggle("active", projectionOpen);
        document.body.classList.toggle("wall-finishes-projection", projectionOpen);

        if (!projectionOpen) {
            removeOverlays();
            wallSignature = "";
            return;
        }

        var backgrounds = wallBackgrounds();
        var room = getRoom();
        var lines = room && room.PRS && room.PRS.lines ? room.PRS.lines : [];
        var signature = getRoomId() + ":" + backgrounds.map(function (rect, index) {
            var line = lines[index] || {};
            return (line.oid || line.id || index) + "/" + rect.getAttribute("x") + "/" + rect.getAttribute("width");
        }).join("|");
        if (signature !== wallSignature) {
            wallSignature = signature;
            scanWalls();
            render();
        }
    }

    function init() {
        loadLocalState();
        patchPersistence();
        createInterface();
        expandProjectionMaterials();
        setInterval(sync, 450);
        sync();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
}());
