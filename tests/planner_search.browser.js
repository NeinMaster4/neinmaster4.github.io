(async function () {
    const output = parent.document.getElementById('results');
    const resultsLog = [];
    window.addEventListener('error', function(e) { resultsLog.push('ERROR '+(e.error && e.error.stack || e.message)); });
    const tick = () => new Promise(resolve => setTimeout(resolve, 100));
    const assert = (value, message) => { if (!value) throw new Error(message); resultsLog.push('PASS ' + message); output.textContent = resultsLog.join('\n'); };
    try {
        for (let i = 0; i < 100 && (!window.app_load || !Object.keys(ROOMS2).length || !document.getElementById('elevation-layer')); i++) await tick();
        await tick(); await tick();
        // Do not write synthetic projects into local storage or the server.
        project.localSave = function () {};
        const r = Object.values(ROOMS2).find(r => r && r.polygon && r.area > 2);
        assert(r, 'A real planner room is available');
        function visibleWaterTools() {
            return [...document.querySelectorAll('#planner_ui_tools .tools_item, #planner_ui_tools .tools_more_item')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.id||n.textContent.trim()).sort();
        }
        document.querySelector('.groups_navi_item[data-plan="waterplan"]').click();await tick();await tick();
        const expected=visibleWaterTools();
        plan='projections';plan_=0;setPlansAndPlansGroup();$Project.draw();r.PRS.get({force:true});r.PRS.draw();
        const layer=document.getElementById('elevation-layer');layer.value='3';layer.dispatchEvent(new Event('change',{bubbles:true}));await tick();
        assert(JSON.stringify(visibleWaterTools())===JSON.stringify(expected),'Elevation and project water modes expose exactly the same tools');
        const field=document.getElementById('planner-project-search');
        assert(field,'Mode search is available');
        function search(text) {document.querySelector('.planner-nav-trigger').click();field.value=text;field.dispatchEvent(new Event('input',{bubbles:true}));}
        search('Водопроводная труба ХВС');
        const results=document.getElementById('planner-project-search-results');
        assert(results.children.length>0,'Search finds water tools');
        results.querySelector('button').click();
        for(let i=0;i<30&&!document.querySelector('.planner-search-guide');i++)await tick();
        assert(plan==='water' && plan_!=='projections','Tool search opens the matching project mode');
        assert(document.getElementById('plannertool_water_pipe').classList.contains('planner-search-found'),'Tool search points to the existing toolbar item');
        assert(tool==='none','Searching does not activate construction');
        search('Стандартное окно');
        assert(results.children.length>0,'Search indexes nested tools');
        results.querySelector('button').click();
        for(let i=0;i<30&&!document.getElementById('plannertool_window').classList.contains('planner-search-found');i++)await tick();
        assert(document.getElementById('plannertool_window').closest('.planner_ui_subtools').classList.contains('active'),'Search opens the nested tool menu');
        assert(document.getElementById('plannertool_window').classList.contains('planner-search-found'),'Search points to the nested result');
        search('абракадабра12345');assert(!results.children.length && document.querySelector('.planner-search-status').textContent==='Ничего не найдено','Unknown queries show an empty result state');
        field.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!field.value && !document.getElementById('groups_navi').hidden,'Escape restores the mode list');
        field.value='Водоснабжение';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();await tick();
        assert(plan==='water','Enter navigates to a matching mode');
        assert(!document.querySelector('.planner_ui_subtools.active'),'A new search result closes the previous nested menu');
        await tick();await tick();
        assert(Math.abs(document.getElementById('planner_ui_tools_wrapper').clientWidth-document.getElementById('planner_ui_tools').offsetWidth)<3,'Closing search submenus also restores the toolbar width');
        output.textContent=resultsLog.join('\n')+'\nALL PASSED';output.className='pass';
    } catch(error) { output.textContent=resultsLog.join('\n')+'\nFAIL '+error.stack;output.className='fail'; }
}());
