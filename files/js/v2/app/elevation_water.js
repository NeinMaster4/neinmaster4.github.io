/* Water elevations are a view of the existing Pipe graph. Plan points stay in plan
 * coordinates; only the additional height/wall metadata lives on its vertices. */
(function () {
    "use strict";
    var TYPES = ["water_pipe", "water_hot_pipe", "drainage_pipe"];
    var COLORS = { water_pipe: "#106fc6", water_hot_pipe: "#dc143c", drainage_pipe: "#3baa00" };
    var NAMES = { water_pipe: "ХВС", water_hot_pipe: "ГВС", drainage_pipe: "Канализация" };
    var layer, selector, drawing, preview, source, drag, waterPress = false, queued = false, rendering = false;
    var ports = [], segmentViews = [], menuPoint, lastWaterState = false, savedToolClasses = [], savedMoreClasses = [];
    var suppressPipeRelease = false, shiftHeld = false, pipeMove = null, measurementLines = null, lastPointer = null;
    var NS = "http://www.w3.org/2000/svg";

    function snapPoint(origin, point, rect) {
        var dx = point.x - origin.x, dy = point.y - origin.y;
        var angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4;
        var ux = Math.cos(angle), uy = Math.sin(angle), length = Math.max(0, dx * ux + dy * uy);
        if (rect) {
            if (ux > 1e-8) length = Math.min(length, (rect.right - origin.x) / ux);
            if (ux < -1e-8) length = Math.min(length, (rect.left - origin.x) / ux);
            if (uy > 1e-8) length = Math.min(length, (rect.bottom - origin.y) / uy);
            if (uy < -1e-8) length = Math.min(length, (rect.top - origin.y) / uy);
        }
        return { x: origin.x + ux * Math.max(0, length), y: origin.y + uy * Math.max(0, length) };
    }
    function constructionPoint(event) {
        var point = eventPoint(event);
        if (source && event.shiftKey) {
            var b = bounds(source.edge);
            point = snapPoint(source, point, { left: b.x, right: b.x + source.edge.length, top: b.floor - params.total_height, bottom: b.floor });
        }
        return point;
    }
    function hideMeasurements() {
        if (measurementLines) { measurementLines.remove(); measurementLines = null; }
    }
    function measurements(point, event, converted) {
        var outline, position = point;
        if (converted) {
            position = converted.screen;
            outline = {edges: LIB.polygonEdges(converted.edge.polygon)};
        } else {
            outline = Object.keys(ROOMS2).map(function (id) { return ROOMS2[id]; }).find(function (r) {
                return r.polygon && LIB.isPointOverPolygon(point, r.polygon);
            });
        }
        if (!outline) { hideMeasurements(); return; }
        // Reuse the editor's dimension lines, ticks and unit formatting.
        if (!measurementLines) measurementLines = new PositionDimensionLines();
        measurementLines.update(position, outline, {tool: "water_pipe"});
        ["t", "b", "l", "r"].forEach(function (side) {
            var line = measurementLines[side];
            if (line) line.GROUP.attr({"data-water-dimension": side, "pointer-events": "none"});
        });
    }
    function finishPipeMove(cancel) {
        if (!pipeMove) return;
        if (cancel) pipeMove.nodes.forEach(function (entry) {
            entry.node.setPoint(Object.assign({}, entry.point), false);
            entry.vertex.point = Object.assign({}, entry.node.pc);
            if (entry.meta) entry.vertex.water_elevation = Object.assign({}, entry.meta); else delete entry.vertex.water_elevation;
        });
        var tree = pipeMove.tree, changed = pipeMove.changed;
        pipeMove = null; asWater(function () { tree.draw(); });
        document.body.style.cursor = "default"; hideMeasurements();
        if (active()) refresh();
        if (changed && !cancel) save(); else schedule();
    }
    function movePipe(event) {
        var p = eventPoint(event), dx = p.x-pipeMove.start.x, dy = p.y-pipeMove.start.y;
        if (pipeMove.elevation) {
            // Clamp the translation as a whole, preserving the shape of the section.
            pipeMove.nodes.forEach(function (entry) {
                var b = bounds(entry.view.edge);
                dx = clamp(dx, b.x-entry.view.x, b.x+entry.view.edge.length-entry.view.x);
                dy = clamp(dy, b.floor-params.total_height-entry.view.y, b.floor-entry.view.y);
            });
        }
        pipeMove.nodes.forEach(function (entry) {
            if (pipeMove.elevation) moveNode(entry.view, {x:entry.view.x+dx, y:entry.view.y+dy});
            else {
                entry.node.setPoint({x:entry.point.x+dx, y:entry.point.y+dy}, false);
                entry.vertex.point = Object.assign({}, entry.node.pc);
                // A plan move invalidates the old wall association; retain its height.
                if (entry.vertex.water_elevation) delete entry.vertex.water_elevation.edge_index;
            }
        });
        pipeMove.changed = Math.abs(dx) + Math.abs(dy) > 0.001;
        asWater(function () { pipeMove.tree.draw(); });
        var first = pipeMove.nodes[0], converted = pipeMove.elevation ? fromScreen({x:first.view.x+dx,y:first.view.y+dy},first.view.edge) : null;
        measurements(first.node.pc, event, converted, first.meta && first.meta.height);
        schedule();
    }
    function installPipeActions() {
        var menu = document.querySelector('#cm-tree [action="split_line"]').parentNode;
        var button = document.createElement("button"); button.type = "button"; button.className = "contextmenu_item_icon move water-pipe-move-action";
        button.setAttribute("aria-label", "Переместить участок");
        var caption = document.createElement("span"); caption.textContent = "Переместить участок"; button.appendChild(caption); button.hidden = true; menu.appendChild(button);
        var selectedPipe, selectedLine, selectedPoint;
        var context = Pipe.prototype.contextmenu;
        Pipe.prototype.contextmenu = function (event) {
            var result = context.apply(this, arguments);
            selectedPipe = this; selectedLine = window.contextmenu_tree_line_id; selectedPoint = eventPoint(event);
            var data = this.getDataByTreeLineId(selectedLine);
            button.hidden = !(active() || window.plan === "water");
            button.disabled = !data || ![this.vertexes[data.vertex_i], this.vertexes[data.vertex_j]].some(function (v) { return v && v.type === "node"; });
            button.title = button.disabled ? "Участок закреплен на приборах. Сначала добавьте свободные узлы." : "Выберите новое положение; Esc — отмена";
            return result;
        };
        // Other graph types share this menu and must not inherit the water action.
        document.addEventListener("mousedown", function (e) { if (!button.contains(e.target)) button.hidden = true; }, true);
        button.addEventListener("mousedown", function (e) { e.stopPropagation(); });
        document.addEventListener("click", function (e) {
            if (!button.contains(e.target) || button.disabled) return;
            stop(e);
            var data = selectedPipe.getDataByTreeLineId(selectedLine); if (!data) return;
            resetSource(); toolOff();
            var nodes = [selectedPipe.vertexes[data.vertex_i], selectedPipe.vertexes[data.vertex_j]].filter(function (v) { return v.type === "node"; }).map(function (v) {
                var node = selectedPipe.getItem(v.id);
                return {node:node, vertex:v, point:Object.assign({},node.pc), meta:v.water_elevation && Object.assign({},v.water_elevation), view:active() ? vertexView(selectedPipe,v) : null};
            });
            if (!nodes.length || (active() && nodes.some(function (n) { return !n.view; }))) return;
            pipeMove = {tree:selectedPipe, nodes:nodes, start:selectedPoint, elevation:active(), changed:false};
            $(".contextmenu").hide(); document.body.style.cursor = "move";
        }, true);
        document.addEventListener("mousedown", function (e) {
            if (pipeMove && e.target.closest && e.target.closest("#main_svg")) { stop(e); suppressPipeRelease = true; finishPipeMove(e.button === 2); }
        }, true);
    }

    function active() { return window.plan_ === "projections" && window.project && project.prs.mode === 3 && !!project.prs.room; }
    function room() { return window.ROOMS2 && project.prs.room && ROOMS2[project.prs.room]; }
    function edges() { var r = room(); return r ? r.PRS.lines : []; }
    function trees() { return $PipingWater.get_trees_from_storage(); }
    function values(collection) { return Object.keys(collection).map(function (key) { return collection[key]; }).filter(function (x) { return x && x.vertexes; }); }
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function original(edge) { return { a: edge.p1_orig || edge.p1, b: edge.p2_orig || edge.p2 }; }
    function onEdge(point, edge) {
        var line = original(edge), dx = line.b.x - line.a.x, dy = line.b.y - line.a.y;
        var length = Math.hypot(dx, dy), along = ((point.x - line.a.x) * dx + (point.y - line.a.y) * dy) / (length || 1);
        var x = clamp(along, 0, length), foot = { x: line.a.x + dx * x / (length || 1), y: line.a.y + dy * x / (length || 1) };
        return { along: x, distance: distance(point, foot), foot: foot };
    }
    function bounds(edge) {
        return { x: Math.min.apply(null, edge.polygon.map(function (p) { return p.x; })),
            floor: Math.max.apply(null, edge.polygon.map(function (p) { return p.y; })) };
    }
    function nearest(point, preferred) {
        var best;
        edges().forEach(function (edge) {
            var p = onEdge(point, edge);
            if (!best || p.distance < best.distance - .01 || (Math.abs(p.distance - best.distance) < .01 && edge.edge_index === preferred)) best = { edge: edge, distance: p.distance, along: p.along };
        });
        return best;
    }
    function fromScreen(point, forcedEdge) {
        var edge = forcedEdge || edges().find(function (e) { var b = bounds(e); return point.x >= b.x && point.x <= b.x + e.length && point.y >= b.floor - params.total_height && point.y <= b.floor; });
        if (!edge) return null;
        var b = bounds(edge), line = original(edge), length = distance(line.a, line.b), along = clamp(point.x - b.x, 0, length);
        var height = Math.round(clamp(b.floor - point.y, 0, params.total_height) * 10) / 10;
        // A small inward offset keeps wall-mounted objects inside their room.
        var sign = edge.room_side === "r" ? 1 : -1, inset = .5;
        var dx = (line.b.x - line.a.x) / (length || 1), dy = (line.b.y - line.a.y) / (length || 1);
        return { point: { x: line.a.x + dx * along - dy * inset * sign, y: line.a.y + dy * along + dx * inset * sign },
            meta: { room: room().id, edge_index: edge.edge_index, height: height }, edge: edge,
            screen: { x: b.x + along, y: b.floor - height } };
    }
    function at(point, height, meta) {
        var p = nearest(point, meta && meta.edge_index);
        if (!p) return null;
        var b = bounds(p.edge);
        return { x: b.x + p.along, y: b.floor - clamp(height || 0, 0, params.total_height), edge: p.edge };
    }
    function asWater(callback) {
        var saved = { plan: window.plan, plan_: window.plan_ };
        var minDistance = $PipingWater.min_distance_new_line, closePrs = $Project.prsClose, localSave = project.localSave;
        project.localSave = function () {};
        if (saved.plan_ === "projections") $Project.prsClose = function () {};
        window.plan = "water"; window.plan_ = 0; $PipingWater.min_distance_new_line = 0;
        try { return callback(); } finally { window.plan = saved.plan; window.plan_ = saved.plan_; $PipingWater.min_distance_new_line = minDistance; $Project.prsClose = closePrs; project.localSave = localSave; }
    }
    function svgElement(tag, attributes, parent) {
        var element = document.createElementNS(NS, tag);
        Object.keys(attributes || {}).forEach(function (name) { element.setAttribute(name, attributes[name]); });
        (parent || drawing).appendChild(element); return element;
    }
    function title(element, text) { var child = svgElement("title", {}, element); child.textContent = text; }
    function eventPoint(event) { return LIB.point(event.clientX, event.clientY, "svg"); }
    function stop(event) {
        if (event.type === "mousedown" && active() && event.target.closest && event.target.closest("#main_svg")) waterPress = true;
        event.preventDefault(); event.stopImmediatePropagation();
    }
    function schedule() {
        if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; sync(); if (active()) render(); }); }
    }
    function save() { project.localSave(); schedule(); }
    function setMeta(tree, id, meta) { var v = tree.vertexes.find(function (v) { return v.id === id; }); if (v) { v.water_elevation = Object.assign({}, meta); tree.updateLength(); } }
    function itemHeight(item, type) {
        var props = item.props, floor = props.over_floor || {};
        return (props.f0offset || 0) + (type === "drainage_pipe" && floor.value_2 !== undefined ? floor.value_2 : floor.value || 0);
    }
    function fixtureTypes(item) {
        var name = item.props.name;
        return TYPES.filter(function (type) { return $PipingWater.waterspots[type][name]; });
    }
    function fixturePort(item, type) {
        var height = itemHeight(item, type), p = at(item.props.pc, height);
        if (!p) return null;
        var name = item.props.name, options = fixtureTypes(item);
        if (name === "gas_boiler") {
            var offset = Math.min(12, (item.props.width || 40) / 4);
            p.x += type === "water_pipe" ? -offset : offset;
        } else if (options.indexOf("water_pipe") !== -1 && options.indexOf("water_hot_pipe") !== -1) {
            p.x += (type === "water_pipe" ? -7 : 7) * (item.props.waterspots_change_sequence ? -1 : 1);
        }
        return p;
    }
    function vertexView(tree, vertex) {
        var item = tree.getItem(vertex.id);
        if (!item) return null;
        if (vertex.type !== "node") return ports.find(function (p) { return p.item === item && p.type === tree.type; });
        var meta = vertex.water_elevation;
        if (meta && meta.room !== room().id) return null;
        var point = item.pc || vertex.point;
        if (!meta && !LIB.isPointOverPolygon(point, room().polygon) && nearest(point).distance > 12) return null;
        var p = at(point, meta ? meta.height : 0, meta);
        return p && { x: p.x, y: p.y, edge: p.edge, node: item, tree: tree, id: vertex.id, type: tree.type };
    }
    function drawPorts() {
        Object.keys(ITEMS).forEach(function (id) {
            var item = ITEMS[id];
            if (!item || !item.props || item.props.demount || !item.props.pc || !$PipingWater.all_items[item.props.name]) return;
            if (item.props.id_room !== room().id && !LIB.isPointOverPolygon(item.props.pc, room().polygon)) return;
            fixtureTypes(item).forEach(function (type) {
                var p = fixturePort(item, type); if (!p) return;
                var port = { x: p.x, y: p.y, edge: p.edge, item: item, id: item.props.id, type: type };
                ports.push(port);
                var circle = svgElement("circle", { cx: p.x, cy: p.y, r: 3.8, fill: "white", stroke: COLORS[type], "stroke-width": 1.6, class: "water-hit", "data-water-item": id, "data-water-type": type });
                title(circle, item.props.name === "gas_boiler" ? (type === "water_pipe" ? "Ввод холодной воды (ХВС)" : "Вывод горячей воды (ГВС)") : (tools[item.props.name].title + " — " + NAMES[type]));
                circle.addEventListener("mousedown", function (e) { portDown(e, port); });
                if (item.props.name === "gas_boiler") {
                    var text = svgElement("text", { x: p.x, y: p.y + (type === "water_pipe" ? 13 : 23), "text-anchor": "middle", fill: COLORS[type], "font-size": 8, "pointer-events": "none" });
                    text.textContent = type === "water_pipe" ? "↑ Ввод ХВС" : "↓ Вывод ГВС";
                }
            });
        });
    }
    function render() {
        if (rendering || !active() || !room() || !edges().length) return;
        rendering = true;
        try {
            if (drawing) drawing.remove();
            ports = []; segmentViews = [];
            drawing = document.createElementNS(NS, "g");
            drawing.setAttribute("class", "elevation-water-drawing");
            layers.prs_sockets.node.parentNode.appendChild(drawing);
            // Existing electrical symbols are grey in mode 3 and cannot receive any events.
            ["prs_sockets", "prs_items", "prs_shields", "prs_trees", "prs_trees_nodes", "prs_freelines", "prs_freelines_nodes"].forEach(function (name) {
                if (layers[name]) layers[name].node.style.pointerEvents = "none";
            });
            drawPorts();
            var linesGroup = svgElement("g", {}, drawing); drawing.insertBefore(linesGroup, drawing.firstChild);
            values(trees()).forEach(function (tree) {
                var views = tree.vertexes.map(function (vertex) { return vertexView(tree, vertex); });
                tree.vertexes.forEach(function (v, i) {
                    var p = views[i]; if (!p) return;
                    for (var j = i + 1; j < views.length; j++) {
                        var q = views[j]; if (!q || !tree.matrix[i] || !tree.matrix[i][j]) continue;
                        var id = tree.getTreeLineId(i, j);
                        var segment = { tree: tree, id: id, p: p, q: q, i: i, j: j };
                        segmentViews.push(segment);
                        svgElement("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, stroke: COLORS[tree.type], "stroke-width": tree.type === "drainage_pipe" ? 2.5 : 1.5, "pointer-events": "none" }, linesGroup);
                        var hit = svgElement("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, stroke: "transparent", "stroke-width": 9, "pointer-events": "stroke", tree_line_id: id, "data-water-tree": tree.id, class: "water-hit" }, linesGroup);
                        title(hit, NAMES[tree.type] + " — перетащите узел; ПКМ — действия с трубой");
                        hit.addEventListener("mousedown", function (e) { segmentDown(e, segment); });
                    }
                    if (p.node) {
                        var circle = svgElement("circle", { cx: p.x, cy: p.y, r: 3, fill: "white", stroke: COLORS[tree.type], "stroke-width": 1.3, class: "water-node", "data-water-node": p.id });
                        title(circle, "Узел " + NAMES[tree.type] + ": " + LIB.lengthInUserUnits(bounds(p.edge).floor - p.y) + " от пола");
                        circle.addEventListener("mousedown", function (e) { nodeDown(e, p); });
                    }
                });
            });
            preview = svgElement("line", { stroke: COLORS[tool] || "#106fc6", "stroke-width": 1.5, "stroke-dasharray": "4 3", "pointer-events": "none", visibility: "hidden" });
        } finally { rendering = false; }
    }
    function begin(port) {
        asWater(function () {
            $PipingWater.unselect_source_item();
            if (port.node && !$PipingWater.get_tree(port.node, true)) {
                $PipingWater.source_item = port.node; $PipingWater.source_id = port.id;
                $PipingWater.source_name = "node"; $PipingWater.source_point = port.node.pc;
                $PipingWater.source_node_id = port.id; $PipingWater.color_line = COLORS[tool];
            } else $PipingWater.mousedown(port.item || port.node, port.id);
        });
        if ($PipingWater.source_id) source = port;
    }
    function connect(port) {
        if (port.type !== tool) return;
        if (!source) { begin(port); return; }
        var previous = source;
        asWater(function () { $PipingWater.mousedown(port.item || port.node, port.id); });
        if (previous.meta) values(trees()).forEach(function (tree) { setMeta(tree, previous.id, previous.meta); });
        source = null; $PipingWater.unselect_source_item(); save();
    }
    function portDown(event, port) {
        stop(event);
        if (event.button === 2) { source = null; asWater(function () { port.item.contextmenu(event); }); schedule(); return; }
        if (event.button !== 0) return;
        if (TYPES.indexOf(tool) !== -1) { connect(port); schedule(); }
        else if (tool === "eraser") { asWater(function () { port.item.delete(); }); refresh(); save(); }
        else if (tool === "none") drag = { port: port, start: eventPoint(event), moved: false };
    }
    function nodeDown(event, view) {
        stop(event);
        if (event.button === 2) { source = null; view.node.contextmenu(event, view.tree); return; }
        if (event.button !== 0) return;
        if (TYPES.indexOf(tool) !== -1) { connect(view); schedule(); }
        else if (tool === "eraser") { asWater(function () { view.node.delete(); }); save(); }
        else drag = { view: view, start: eventPoint(event), moved: false };
    }
    function segmentDown(event, segment) {
        stop(event);
        var point = eventPoint(event);
        if (event.button === 2) {
            source = null;
            var converted = fromScreen(point);
            segment.tree.contextmenu(event);
            if (converted) window.contextmenu_tree_line_point = converted.point;
            menuPoint = converted;
        } else if (event.button === 0 && tool === "eraser") { asWater(function () { segment.tree.deleteByLine(segment.id); }); save(); }
        else if (event.button === 0 && tool === "waterspot_node") { splitSegment(segment, point, false); }
        else if (event.button === 0 && TYPES.indexOf(tool) !== -1 && tool === segment.tree.type) {
            splitSegment(segment, point, true);
        } else if (event.button === 0 && tool === "none") {
            // Moving a segment moves its free endpoints. Attached fixtures stay anchored.
            drag = { segment: segment, start: point, moved: false, nodes: [segment.p, segment.q].filter(function (p) { return p.node; }).map(function (p) { return { view: p, x: p.x, y: p.y }; }) };
        }
    }
    function moveNode(view, screen) {
        var converted = fromScreen(screen, view.edge); if (!converted) return;
        var oldFoot = onEdge(view.node.pc, view.edge).foot, newFoot = onEdge(converted.point, view.edge).foot;
        converted.point = { x: newFoot.x + view.node.pc.x-oldFoot.x, y: newFoot.y + view.node.pc.y-oldFoot.y };
        view.node.setPoint(Object.assign({}, converted.point), false);
        var v = view.tree.vertexes.find(function (v) { return v.id === view.id; });
        v.point = Object.assign({}, view.node.pc); v.water_elevation = converted.meta;
        asWater(function () { view.tree.draw(); });
    }
    function refresh() { if (room()) { room().PRS.get({ force: true }); $Project.updatePrs(); } }
    function resetSource() { hideMeasurements(); source = null; if (window.$PipingWater) $PipingWater.unselect_source_item(); if (preview) preview.setAttribute("visibility", "hidden"); }
    function canvasDown(event) {
        if (!active() || !event.target.closest || !event.target.closest("#main_svg") || event.target.closest(".elevation-water-drawing")) return;
        if (event.button === 1 || event.altKey || event.ctrlKey || event.metaKey) return;
        var converted = fromScreen(constructionPoint(event), source && event.shiftKey ? source.edge : null); if (!converted) return;
        stop(event);
        if (event.button === 2) { resetSource(); return; }
        if (TYPES.indexOf(tool) !== -1) {
            if (!source) {
                var node = asWater(function () { return $PipingWater.add_node_item(tool, converted.point, room().id); });
                begin({ node: node, id: node.id, type: tool, x: converted.screen.x, y: converted.screen.y, edge: converted.edge, meta: converted.meta });
                $PipingWater.source_node_id = node.id;
            } else {
                var previous = source, next;
                asWater(function () { $PipingWater.mousedown(null, null, null, { center: converted.point, id_room: room().id }); next = $PipingWater.get_node($PipingWater.last_node_id); });
                if (next && next.id !== previous.id) {
                    var tree = $PipingWater.get_tree(next, true);
                    if (tree) { setMeta(tree, next.id, converted.meta); if (previous.meta) setMeta(tree, previous.id, previous.meta); }
                    begin({ node: next, id: next.id, type: tool, x: converted.screen.x, y: converted.screen.y, edge: converted.edge });
                    save();
                }
            }
            schedule();
        } else if (tool.indexOf("waterspot_") === 0 && tool !== "waterspot_node") {
            placeFixture(tool, converted); refresh(); save();
        } else if (tool === "waterspot_node") {
            var closest = segmentViews.map(function (s) { var a = s.p, b = s.q, dx = b.x-a.x, dy = b.y-a.y, t = clamp(((converted.screen.x-a.x)*dx+(converted.screen.y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1); return { segment:s, d:distance(converted.screen,{x:a.x+t*dx,y:a.y+t*dy}) }; }).sort(function (a,b) {return a.d-b.d;})[0];
            if (closest && closest.d < 12) splitSegment(closest.segment, converted.screen, false);
        }
    }
    function placeFixture(name, converted) {
        asWater(function () {
            var edge = converted.edge, angle = LIB.lineAngle(LIB.l(original(edge).a, original(edge).b)) + (edge.room_side === "r" ? 180 : 0);
            var item = new Item({ name: name, pc: converted.point, angle: angle, projection: converted.point, id_room: room().id, id_wall: edge.pid && WALLS[edge.pid] ? edge.pid : undefined, plan: { water: 1 } });
            ITEMS[item.props.id] = item;
            if (item.props.over_floor) { item.props.over_floor.value = converted.meta.height - (item.props.f0offset || 0); if (item.props.over_floor.value_2 !== undefined) item.props.over_floor.value_2 = item.props.over_floor.value; }
            item.draw(null, { force_draw: true });
        });
    }
    function splitSegment(segment, point, extend) {
        var converted = fromScreen(point); if (!converted) return;
        var before = segment.tree.vertexes.map(function (v) { return v.id; });
        asWater(function () { var end = mouse.end; mouse.end = converted.point;
            try { segment.tree.splitLine(segment.id, converted.point); } finally { mouse.end = end; } });
        var vertex = segment.tree.vertexes.find(function (v) { return before.indexOf(v.id) === -1; });
        if (vertex) {
            vertex.water_elevation = converted.meta;
            if (extend) begin({ node: segment.tree.nodes[vertex.id], id: vertex.id, type: segment.tree.type, x: point.x, y: point.y, edge: converted.edge });
        }
        save();
    }
    function move(event) {
        lastPointer = event;
        shiftHeld = !!event.shiftKey;
        if (pipeMove) { stop(event); movePipe(event); return; }
        if (!active()) {
            if (window.plan === "water" && TYPES.indexOf(tool) !== -1 && !$PipingWater.source_id && event.target.closest && event.target.closest("#main_svg")) measurements(eventPoint(event), event, null, 0);
            return;
        }
        if (drag) {
            var p = eventPoint(event); stop(event);
            if (distance(p, drag.start) < 1 && !drag.moved) return;
            drag.moved = true;
            if (drag.view) moveNode(drag.view, p);
            else if (drag.nodes) drag.nodes.forEach(function (n) { moveNode(n.view, { x: n.x + p.x-drag.start.x, y: n.y + p.y-drag.start.y }); });
            else if (drag.port) {
                var converted = fromScreen(p, drag.port.edge), item = drag.port.item;
                if (converted) asWater(function () {
                    var oldFoot = onEdge(item.props.pc, converted.edge).foot, newFoot = onEdge(converted.point, converted.edge).foot;
                    converted.point = { x: newFoot.x + item.props.pc.x-oldFoot.x, y: newFoot.y + item.props.pc.y-oldFoot.y };
                    item.props.pc = converted.point; item.pc = converted.point; item.props.projection = newFoot;
                    if (item.props.over_floor) { var key = drag.port.type === "drainage_pipe" && item.props.over_floor.value_2 !== undefined ? "value_2" : "value"; item.props.over_floor[key] = Math.max(0, converted.meta.height-(item.props.f0offset || 0)); }
                    item.draw(null, { force_draw: true });
                });
            }
            var measured = fromScreen(p, drag.view ? drag.view.edge : drag.port ? drag.port.edge : null);
            if (measured) measurements(measured.point, event, measured);
            schedule();
        } else if (source && preview) {
            if (!event.target.closest || !event.target.closest("#main_svg")) return;
            stop(event); var target = constructionPoint(event);
            measurements(target, event, fromScreen(target, event.shiftKey ? source.edge : null));
            preview.setAttribute("x1", source.x); preview.setAttribute("y1", source.y); preview.setAttribute("x2", target.x); preview.setAttribute("y2", target.y); preview.setAttribute("visibility", "visible");
        } else if (event.target.closest && event.target.closest("#main_svg") && (TYPES.indexOf(tool) !== -1 || tool.indexOf("waterspot_") === 0)) {
            // Do not let the plan editor treat elevation coordinates as floor coordinates.
            stop(event);
            var measured = fromScreen(eventPoint(event));
            if (measured) measurements(measured.point, event, measured); else hideMeasurements();
        }
    }
    function sync() {
        var isWater = active();
        document.body.classList.toggle("elevation-water", isWater);
        if (isWater !== lastWaterState) {
            if (isWater) {
                savedToolClasses = Array.prototype.slice.call(document.querySelectorAll("#planner_ui_tools .tools_item.show"));
                savedMoreClasses = Array.prototype.slice.call(document.querySelectorAll("#planner_ui_tools .tools_more_item.active"));
                document.querySelectorAll("#planner_ui_tools .tools_more_item").forEach(function (item) { item.classList.toggle("active", item.classList.contains("show_on_waterplan")); });
                document.querySelectorAll("#planner_ui_tools .tools_item").forEach(function (item) { item.classList.toggle("show", item.classList.contains("show_on_waterplan")); });
            } else if (window.plan === "projections") {
                document.querySelectorAll("#planner_ui_tools .tools_item.show_on_waterplan").forEach(function (item) { item.classList.remove("show"); });
                savedToolClasses.forEach(function (item) { item.classList.add("show"); });
                document.querySelectorAll("#planner_ui_tools .tools_more_item").forEach(function (item) { item.classList.toggle("active", savedMoreClasses.indexOf(item) !== -1); });
            }
            lastWaterState = isWater;
            if (window.check_tools_placement) check_tools_placement();
        }
        if (selector && window.project) selector.value = String(project.prs.mode || 1);
        if (!isWater) {
            if (drawing) { drawing.remove(); drawing = null; }
            ["prs_sockets", "prs_items", "prs_shields", "prs_trees", "prs_trees_nodes", "prs_freelines", "prs_freelines_nodes"].forEach(function (name) { if (window.layers && layers[name]) layers[name].node.style.pointerEvents = ""; });
        }
    }
    function patchBoiler() {
        var piping = $PipingWater;
        piping.all_items.gas_boiler = 1;
        piping.pipes_by_name.gas_boiler = ["water_pipe", "water_hot_pipe"];
        ["water_pipe", "water_hot_pipe"].forEach(function (type) {
            piping.waterspots[type].gas_boiler = 1;
            Object.keys(piping.source_items[type]).forEach(function (name) { piping.source_items[type][name].gas_boiler = 1; });
            piping.source_items[type].gas_boiler = piping.waterspots[type];
        });
        var getPoint = piping.get_point;
        piping.get_point = function (type, item) {
            if (item && item.props && item.props.name === "gas_boiler" && TYPES.indexOf(type) < 2 && TYPES.indexOf(type) >= 0) {
                item.getPolygon(); var polygon = item.polygon;
                if (polygon && polygon.length >= 4) { var a = polygon[3], b = polygon[2], t = type === "water_pipe" ? .25 : .75; return { x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t }; }
            }
            return getPoint.apply(this, arguments);
        };
        [window.tools, window.global_tools].forEach(function (catalog) {
            if (!catalog || !catalog.gas_boiler) return;
            var boiler = catalog.gas_boiler;
            boiler.title = "Газовый котел";
            // The legacy boiler had only a plan symbol, so it disappeared in elevations.
            if (!boiler.path_front) {
                boiler.path_front = "M0 0H40V60H0ZM5 6H35V38H5ZM8 45H32V53H8ZM9 60V64M31 60V64";
                boiler.path_back = "M0 0H40V60H0ZM9 60V64M31 60V64";
                boiler.path_left = boiler.path_right = "M0 0H25V60H0ZM5 6H20V53H5Z";
                boiler.self_height = boiler.self_height || 60;
            }
        });
    }
    function init() {
        if (!window.$Project || !window.$PipingWater || !window.project) { setTimeout(init, 100); return; }
        layer = document.getElementById("projections_modes_tab"); if (!layer || document.getElementById("elevation-layer")) return;
        var label = document.createElement("label"); label.className = "elevation-layer-label"; label.htmlFor = "elevation-layer"; label.textContent = "Слои развертки";
        selector = document.createElement("select"); selector.id = "elevation-layer";
        [[2,"Отделка и декор"],[1,"Мебель и инженерия"],[3,"Водоснабжение"]].forEach(function (entry) { var option = document.createElement("option"); option.value = entry[0]; option.textContent = entry[1]; selector.appendChild(option); });
        layer.appendChild(label); layer.appendChild(selector);
        selector.addEventListener("change", function () { var mode = Number(selector.value); finishPipeMove(true); resetSource(); toolOff(); $Project.setModePrs(mode); schedule(); });
        ["mousedown", "mouseup", "click", "keydown", "keyup"].forEach(function (name) { selector.addEventListener(name, function (e) { e.stopPropagation(); }); });
        var heading = document.createElement("h3"); heading.className = "planner-tools-heading"; heading.textContent = "Инструменты"; heading.title = "Инструменты";
        var toolbar = document.getElementById("planner_ui_tools"); toolbar.insertBefore(heading, toolbar.firstChild);
        var close = document.getElementById("prs_close"); close.setAttribute("role", "button"); close.tabIndex = 0;
        close.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); close.click(); } });
        close.addEventListener("click", function () { finishPipeMove(true); resetSource(); schedule(); });
        patchBoiler();
        installPipeActions();
        var waterMove = $PipingWater.mousemove;
        $PipingWater.mousemove = function () {
            var raw = Object.assign({}, mouse.end), result = waterMove.apply(this, arguments);
            if (window.plan === "water" && !active() && TYPES.indexOf(tool) !== -1 && this.source_id) {
                if (shiftHeld) {
                    var snapped = snapPoint(this.source_point, raw);
                    if (distance(snapped, mouse.end) > .01) {
                        this.target_item = this.target_id = this.target_connect = this.target_tree_line = null;
                        mouse.end = snapped; this.target_point = snapped;
                        this.temporary_line.draw(this.source_point, snapped, this.color_line, this.get_stroke(tool), tool);
                    }
                }
                var node = this.source_item, tree = node && this.get_tree(node, true);
                var vertex = tree && tree.vertexes.find(function (v) { return v.id === node.id; });
                var height = vertex && vertex.water_elevation ? vertex.water_elevation.height : node && node.props && node.props.name !== "node" ? itemHeight(node, tool) : 0;
                measurements(mouse.end, lastPointer, null, height);
            }
            return result;
        };
        var waterDown = $PipingWater.mousedown;
        $PipingWater.mousedown = function () {
            if (active() || document.body.classList.contains("elevation-water") || window.plan !== "water" || !this.source_id) return waterDown.apply(this, arguments);
            var oldIds = new Set(), sourceNode = this.source_item;
            values(trees()).forEach(function (tree) { tree.vertexes.forEach(function (v) { oldIds.add(v.id); }); });
            var sourceTree = sourceNode && this.get_tree(sourceNode, true);
            var sourceVertex = sourceTree && sourceTree.vertexes.find(function (v) { return v.id === sourceNode.id; });
            var height = sourceVertex && sourceVertex.water_elevation ? sourceVertex.water_elevation.height : sourceNode && sourceNode.props.name !== "node" ? itemHeight(sourceNode, tool) : 0;
            var result = waterDown.apply(this, arguments), changed = false;
            values(trees()).forEach(function (tree) { tree.vertexes.forEach(function (v) {
                if (v.type !== "node" || oldIds.has(v.id) || v.water_elevation) return;
                var containingRoom = Object.keys(ROOMS2).find(function (id) { return ROOMS2[id].polygon && LIB.isPointOverPolygon(v.point, ROOMS2[id].polygon); });
                if (containingRoom) { setMeta(tree, v.id, {room:containingRoom, height:height}); changed = true; }
            }); });
            if (changed) project.localSave();
            return result;
        };
        function refreshAnglePreview(held) {
            shiftHeld = held;
            if (!lastPointer) return;
            if (active()) move({clientX:lastPointer.clientX,clientY:lastPointer.clientY,target:lastPointer.target,shiftKey:held,preventDefault:function(){},stopImmediatePropagation:function(){}});
            else if (window.plan === "water" && TYPES.indexOf(tool) !== -1 && $PipingWater.source_id) {
                mouse.end = eventPoint(lastPointer); $PipingWater.mousemove();
            }
        }
        document.addEventListener("keydown", function (e) {
            if (e.key === "Shift") refreshAnglePreview(true);
            if (e.key === "Escape") { finishPipeMove(true); hideMeasurements(); }
        }, true);
        document.addEventListener("keyup", function (e) {
            if (e.key !== "Shift") return;
            refreshAnglePreview(false);
        }, true);
        window.addEventListener("blur", function () { shiftHeld = false; finishPipeMove(true); hideMeasurements(); });
        document.addEventListener("mousemove", function (e) {
            shiftHeld = e.shiftKey;
            if (!e.target.closest || !e.target.closest("#main_svg") || (!active() && (window.plan !== "water" || TYPES.indexOf(tool) === -1) && !pipeMove)) hideMeasurements();
        });
        var draw = Projections.prototype.drawOne;
        Projections.prototype.drawOne = function () { var result = draw.apply(this, arguments); sync(); if (active()) render(); return result; };
        var getLength = Pipe.prototype.getLength;
        Pipe.prototype.getLength = function () {
            if (!this.vertexes.some(function (v) { return !!v.water_elevation; })) return getLength.apply(this, arguments);
            var tree = this, length = 0;
            this.vertexes.forEach(function (a, i) {
                for (var j = i + 1; j < tree.vertexes.length; j++) {
                    if (!tree.matrix[i] || !tree.matrix[i][j]) continue;
                    var b = tree.vertexes[j], itemA = tree.getItem(a.id), itemB = tree.getItem(b.id);
                    if (!itemA || !itemB) continue;
                    var position = tree.getPosition(a.id, b.id, i, j);
                    var heightA = a.type === "node" ? (a.water_elevation && a.water_elevation.height || 0) : itemHeight(itemA, tree.type);
                    var heightB = b.type === "node" ? (b.water_elevation && b.water_elevation.height || 0) : itemHeight(itemB, tree.type);
                    length += Math.hypot(distance(position.p1 || tree.getPoint(itemA,a.id), position.p2 || tree.getPoint(itemB,b.id)), heightB-heightA);
                }
            });
            return length;
        };
        var split = Pipe.prototype.splitLine;
        Pipe.prototype.splitLine = function (id, point) {
            if (!active()) return split.apply(this, arguments);
            var tree = this, before = tree.vertexes.map(function (v) { return v.id; }), end = mouse.end;
            var metadata = menuPoint && menuPoint.meta;
            mouse.end = point;
            try {
                var result = asWater(function () { return split.call(tree, id, point); });
                tree.vertexes.forEach(function (v) { if (before.indexOf(v.id) === -1 && metadata) v.water_elevation = Object.assign({}, metadata); });
                return result;
            } finally { mouse.end = end; }
        };
        ["build_santeh_nodes", "build_santeh_pipes"].forEach(function (name) {
            var build = window[name];
            if (typeof build !== "function") return;
            window[name] = function () {
                if (!active()) return build.apply(this, arguments);
                var context = this, args = arguments;
                var result = asWater(function () { return build.apply(context, args); });
                refresh(); save(); return result;
            };
        });
        var localSave = project.localSave;
        project.localSave = function () { var result = localSave.apply(this, arguments); schedule(); return result; };
        var select = window.select_tool;
        window.select_tool = function () {
            hideMeasurements();
            if (pipeMove) finishPipeMove(true);
            if (active()) resetSource();
            var result = select.apply(this, arguments);
            if (active()) document.body.style.cursor = TYPES.indexOf(tool) !== -1 || tool.indexOf("waterspot_") === 0 ? "crosshair" : "default";
            schedule(); return result;
        };
        new MutationObserver(schedule).observe(layer, { attributes: true, attributeFilter: ["class"] });
        document.addEventListener("click", function (event) {
            if (!active()) return;
            var item = event.target.closest("#planner_ui_tools .tools_item.show_on_waterplan");
            if (!item || !item.id) return;
            stop(event); resetSource(); toolOff();
            select_tool(item.id.replace("plannertool_", ""));
            document.querySelectorAll("#planner_ui_tools .tools_item.active").forEach(function (node) { node.classList.remove("active"); });
            item.classList.add("active");
        }, true);
        document.addEventListener("mousedown", canvasDown, true);
        document.addEventListener("mousemove", move, true);
        document.addEventListener("mouseup", function (e) {
            if (suppressPipeRelease) { suppressPipeRelease = false; stop(e); }
            if (waterPress) { waterPress = false; stop(e); }
            if (drag) { stop(e); var changed = drag.moved; drag = null; if (changed) { refresh(); save(); } }
        }, true);
        document.addEventListener("contextmenu", function (e) { if (active() && e.target.closest("#main_svg")) e.preventDefault(); }, true);
        document.addEventListener("keydown", function (e) { if (active() && e.key === "Escape") { resetSource(); drag = null; schedule(); } });
        document.addEventListener("click", function (e) {
            if (active() && e.target.closest("#cm-tree, #cm-tree-node, #cm-furniture")) {
                if (menuPoint) {
                    values(trees()).forEach(function (tree) { tree.vertexes.forEach(function (v) { if (v.type === "node" && !v.water_elevation && distance(v.point, menuPoint.point) < 1) v.water_elevation = Object.assign({}, menuPoint.meta); }); });
                    menuPoint = null;
                }
                refresh(); save();
            }
        });
        sync();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}());
