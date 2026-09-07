(async function () {
    const output = parent.document.getElementById('results');
    const results = [];
    window.addEventListener('error', function(e) { results.push('ERROR '+(e.error && e.error.stack || e.message)); });
    const tick = () => new Promise(resolve => setTimeout(resolve, 100));
    const assert = (value, message) => { if (!value) throw new Error(message); results.push('PASS ' + message); output.textContent = results.join('\n'); };
    try {
        for (let i = 0; i < 100 && (!window.app_load || !Object.keys(ROOMS2).length || !document.getElementById('elevation-layer')); i++) await tick();
        await tick(); await tick();
        // Do not write synthetic projects into local storage or the server.
        project.localSave = function () {};
        const r = Object.values(ROOMS2).find(r => r && r.polygon && r.area > 2);
        assert(r, 'A real planner room is available');
        plan = 'projections'; plan_ = 0; setPlansAndPlansGroup();
        $Project.draw(); r.PRS.get({force:true}); r.PRS.draw();
        const select = document.getElementById('elevation-layer');
        select.value = '3'; select.dispatchEvent(new Event('change',{bubbles:true})); await tick();
        assert(project.prs.mode === 3 && document.body.classList.contains('elevation-water'), 'Selecting water keeps mode 3 active');
        assert(document.querySelectorAll('#elevation-layer option').length === 3, 'All three layers are available');
        const edge = r.PRS.lines.find(e => e.length > 130);
        const origin = Math.min(...edge.polygon.map(p=>p.x)), floor = Math.max(...edge.polygon.map(p=>p.y));
        function mouseAt(x,y,type='mousedown',button=0,target) {
            const root = document.getElementById('main_svg'), point=root.createSVGPoint();point.x=x;point.y=y;
            const screen=point.matrixTransform(root.getScreenCTM());
            (target || root).dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,clientX:screen.x,clientY:screen.y,button,buttons:type==='mouseup'?0:1}));
            if (arguments.length === 2) root.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,clientX:screen.x,clientY:screen.y,button:0,buttons:0}));
        }
        function pointer(x, y, type, shift=false, target) {
            const root=document.getElementById('main_svg'), pt=root.createSVGPoint();pt.x=x;pt.y=y;
            const screen=pt.matrixTransform(root.getScreenCTM());
            const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:screen.x,clientY:screen.y,shiftKey:shift,button:0});
            const actual=LIB.point(event.clientX,event.clientY,'svg');
            (target||root).dispatchEvent(event);
            return actual;
        }
        select_tool('water_pipe'); mouseAt(origin+30,floor-100); await tick();
        pointer(origin+90,floor-145,'mousemove',true);
        assert(document.querySelector('.water-pipe-measurements').textContent.includes('Потолок:'), 'Elevation preview shows surface distances');
        pointer(origin+90,floor-145,'mousedown',true); pointer(origin+90,floor-145,'mouseup',true); await tick();
        const pipe=Object.values(PIPES).find(p=>p && p.vertexes && p.vertexes.some(v=>v.water_elevation));
        assert(pipe && pipe.vertexes.length===2, 'Shift construction creates a pipe');
        const a=pipe.vertexes[0], b=pipe.vertexes[1];
        assert(Math.abs(LIB.distance(a.point,b.point)-Math.abs(a.water_elevation.height-b.water_elevation.height))<.2, 'Shift saves a 45 degree elevation segment');
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));select_tool('none');
        const snapshot=JSON.stringify(pipe.serialize());
        let hit=document.querySelector('[data-water-tree="'+pipe.id+'"]');
        mouseAt(origin+50,floor-120,'mousedown',2,hit);await tick();
        const action=document.querySelector('.water-pipe-move-action');
        assert(!action.hidden && !action.disabled,'Pipe context menu exposes move action');
        action.click();pointer(origin+60,floor-130,'mousemove');await tick();
        assert(Math.abs(a.water_elevation.height-110)<.2,'Move action changes elevation height');
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();
        assert(JSON.stringify(pipe.serialize())===snapshot,'Escape restores the entire section');
        hit=document.querySelector('[data-water-tree="'+pipe.id+'"]');
        mouseAt(origin+50,floor-120,'mousedown',2,hit); action.click();
        pointer(origin+60,floor-130,'mousemove');pointer(origin+60,floor-130,'mousedown');pointer(origin+60,floor-130,'mouseup');await tick();
        assert(Math.abs(a.water_elevation.height-110)<.2,'Click commits the moved elevation section');
        const savedHeight=a.water_elevation.height;
        $Project.prsClose();plan='water';plan_=0;setPlansAndPlansGroup();$Project.draw();await tick();
        const start={x:a.point.x,y:a.point.y}, nativeLine=pipe.IMAGE.node.querySelector('[tree_line_id]');
        const pt=document.getElementById('main_svg').createSVGPoint();pt.x=start.x;pt.y=start.y;
        const screen=pt.matrixTransform(document.getElementById('main_svg').getScreenCTM());
        const actualStart=LIB.point(screen.x,screen.y,'svg');
        pipe.contextmenu({clientX:screen.x,clientY:screen.y,target:nativeLine});action.click();
        const actualEnd=pointer(start.x+8,start.y+12,'mousemove');pointer(start.x+8,start.y+12,'mousedown');pointer(start.x+8,start.y+12,'mouseup');await tick();
        assert(Math.abs(a.point.x-start.x-(actualEnd.x-actualStart.x))<.01 && Math.abs(a.point.y-start.y-(actualEnd.y-actualStart.y))<.01,'Move action works on the project water plan');
        assert(a.water_elevation.height===savedHeight,'Plan movement preserves pipe height');
        select_tool('water_pipe');
        $PipingWater.source_item=pipe.getItem(a.id);$PipingWater.source_id=a.id;$PipingWater.source_point=a.point;$PipingWater.source_name='node';
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Shift',bubbles:true}));
        mouse.end={x:a.point.x-51,y:a.point.y+34};$PipingWater.mousemove();
        const end=$PipingWater.target_point;
        assert(Math.abs(Math.abs(end.x-a.point.x)-Math.abs(end.y-a.point.y))<.01,'Shift snaps the native water plan preview to 45 degrees');
        const beforeCount=pipe.vertexes.length;
        $PipingWater.mousedown(null,null,null,{center:end,id_room:r.id});
        assert(pipe.vertexes.length===beforeCount+1,'Shift construction commits the native plan endpoint');
        const added=pipe.vertexes[pipe.vertexes.length-1];
        assert(added.water_elevation && added.water_elevation.height===savedHeight,'A new plan section inherits its source height');
        $PipingWater.source_item=pipe.getItem(added.id);$PipingWater.source_id=added.id;$PipingWater.source_point=added.point;$PipingWater.source_name='node';
        mouse.end={x:$PipingWater.source_point.x+1,y:$PipingWater.source_point.y+70};$PipingWater.mousemove();
        assert(Math.abs($PipingWater.target_point.x-$PipingWater.source_point.x)<.01,'Shift also snaps to 90 degrees');
        assert(getComputedStyle(document.getElementById('plannertool_water_pipe'),'::before').backgroundImage.includes('.svg'),'Water tools use vector icons');
        const tip=document.querySelector('.footer_bar_comment');tip.classList.add('expandOpen');
        assert(getComputedStyle(tip).animationName==='none','Footer tooltip keeps its position without a transform animation');
        output.textContent=results.join('\n')+'\nALL PASSED';output.className='pass';
    } catch(error) { output.textContent=results.join('\n')+'\nFAIL '+error.stack;output.className='fail'; }
}());
