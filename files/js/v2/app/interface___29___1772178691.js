active_modal_from_id = false;
active_modal_content = false;

function load_v2_modal(method) {
	active_modal_from_id = false;
	active_modal_content = false;

	$.ajax({
		url: langUrl + '/planner/modal/',
	    cache: false,
	    dataType : "html",
	    timeout: 15000,
	    data: "method=" + method,
	    success: function (data, textStatus) {

			$("#canvas_v2_wrapper").append(data);

			if (method === 'pdf') {
				let options = localStorage.print_options;
				if (options) {

					options = JSON.parse(options);
					console.warn("interface >> options", options);
					if (options) {

						$Printer.author = options.author;
						$('input[name="pdf_author"]').val($Printer.author);
					}
				}

				let settings = $("#pdf_settings_core").data('print_settings');
				if (settings) {

					settings = JSON.parse(atob(settings));
					console.warn("interface >> settings", settings);

					// Ориентация pdf -------------------------------------------------------------

					// $Printer.orientation = settings.orientation;
					// $('input[name="pdf_orientation"]').val($Printer.orientation);

					// Название, адрес проекта ----------------------------------------------------

					$Printer.address = settings.address;
					$('input[name="pdf_address"]').val($Printer.address);

					// Номер проекта --------------------------------------------------------------

					$Printer.number = settings.number || $("body").attr("data-object-id");
					let number_target = $('#pdf_settings_core input[name="pdf_number"]');
					// по умолчанию
					number_target.val("").attr("placeholder", $("body").attr("data-object-id"));
					// если есть значение
					if ($Printer.number) number_target.val($Printer.number);
					// console.log("interface >> number", $Printer.number);

					// Включить все планы в печать ------------------------------------------------

					$Printer.allPlans = settings.allPlans;
					$("#config_pdf_plans input").prop('checked', $Printer.allPlans);
					// console.log("interface >> allPlans", $Printer.allPlans);

					// Включить в печать только текущий план --------------------------------------

					$Printer.currentPlan = settings.currentPlan;
					$("#config_pdf_plans_current input").prop('checked', $Printer.currentPlan);
					// console.log("interface >> currentPlan", $Printer.currentPlan);

					// Удаляем кастомные планы из списка планов на печать

					for (let i = 0; i < $Printer.plans.length; i++) {
						if ($Printer.plans[i].is_custom_plan) {
							$Printer.plans.splice(i, 1);
							i--;
						}
					}

					// Добавляем произвольные планы

					if (CUSTOM_PLANS.length() > 0) {

						// собираем планы

						let custom_plans = {};

						$('#groups_navi .groups_navi_item.custom').each(function (index, element) {

							let id = $(element).data('id');

							let custom_plan = CUSTOM_PLANS[id];

							if (custom_plan) {

								if (!custom_plans[custom_plan.after_plan]) {
									custom_plans[custom_plan.after_plan] = [];
								}
								custom_plans[custom_plan.after_plan].push(custom_plan);
							}
						});

						// идём по планам и добавляем их в окно настроек печати
						for (let plan_name in custom_plans) {

							let pdf_settings_plan = $('#config_pdf_columns .pdf_settings_plan[data-plan="' + plan_name + '"]');

							// если есть такой план
							if (pdf_settings_plan.length > 0) {

								// собираем html код и массив

								let html = '';
								let array_plans = [];

								for (let i = 0; i < custom_plans[plan_name].length; i++) {

									let custom_plan = custom_plans[plan_name][i];

									html += `<div class="pdf_settings_plan hidden" data-plan="custom_${custom_plan.id}"><input type="checkbox" data-n="${custom_plan.id}" name="plan['${custom_plan.id}']" id="pad_plan${custom_plan.id}_box" /><label for="pad_plan${custom_plan.id}_box">${custom_plan.name}</label></div>`;

									array_plans.push({
										n: custom_plan.id,
										ru: custom_plan.name,
										sys: 'custom_' + custom_plan.id,
										print: false,
										is_custom_plan: true,
									});
								}

								// добавляем новые элементы
								pdf_settings_plan.after(html);

								// находим индекс плана в массиве планов

								let index_plan = null;
								let n = pdf_settings_plan.find('input').data('n');

								for (let i = 0; i < $Printer.plans.length; i++) {
									if ($Printer.plans[i].n == n) {
										index_plan = i;
										break;
									}
								}

								if (index_plan !== null) {

									// вставляем массив
									$Printer.plans.splice(index_plan + 1, 0, ...array_plans);
								}
							}
						}

						// увеличиваем высоту блока со списком планов
						let max_height = 200 + Math.ceil(CUSTOM_PLANS.length() / 3) * 25;
						$('#config_pdf_columns').css('max-height', max_height + 'px');
					}

					// Открываем окно с ручным выбором планов -------------------------------------

					if (!$Printer.allPlans && !$Printer.currentPlan) {
						if (settings.checkedPages) {
							for (let i = 0; i < settings.checkedPages.length; i++) {
								if (settings.checkedPages[i] > 0 || typeof settings.checkedPages[i] === 'string') {
									$("#config_pdf_columns").removeClass("hidden");
									$("#pdf_settings_plans .pdf_settings_plan").removeClass("hidden");
									$("#config_pdf_columns #pad_plan" + settings.checkedPages[i] + "_box").prop('checked', true);
								}
							}
							$("#pdf_settings_plans #config_pdf_columns .pdf_settings_plan").removeClass("hidden");
						}
					}

					// Включить развертки в печать ------------------------------------------------

					$Printer.projections = settings.projections;
					$("#config_projections input").prop('checked', $Printer.projections);
					// console.log("interface >> projections", $Printer.projections);

					// Разделить электропроводку по группам ---------------------------------------

					$Printer.splitCables = settings.splitCables;
					$("#config_pdf_plans-split_cables input").prop('checked', $Printer.splitCables);
					// console.log("interface >> splitCables", $Printer.splitCables);

					// Масштабирование шрифта во всем документе -----------------------------------

					$Printer.fontScale = settings.fontScale;
					$("select[name='pdf_fonts_scale'] option[value='" + $Printer.fontScale + "']").prop('selected', true);
					// console.log("interface >> fontScale", $Printer.fontScale);

					// Показываем селект с выбором размера шрифта ---------------------------------

					$("#pdf_settings_font_scale").removeClass("manual");
					if ($Printer.fontScale == "manual") {
						$("#pdf_settings_font_scale").addClass("manual");
					}

					// Размер шрифта в случае ручного выбора --------------------------------------

					$Printer.fontSize = settings.fontSize;
					$("select[name='pdf_cover_title_font_size'] option[value='" + $Printer.fontSize + "']").prop('selected', true);
					// console.log("interface >> fontSize", $Printer.fontSize);

					// Единый масштаб на всех листах ----------------------------------------------

					$Printer.commonScale = settings.commonScale;
					$("#config_pdf_plans_common_scale input").prop('checked', $Printer.commonScale);
					// console.log("interface >> commonScale", $Printer.commonScale);

					// Скрыть обозначения (легенды) -----------------------------------------------

					$Printer.hideLegends = settings.hideLegends;
					$("#config_pdf_plans_no_legend input").prop('checked', $Printer.hideLegends);
					// console.log("interface >> hideLegends", $Printer.hideLegends);

					// Название проекта -------------------------------------------------------

					$Printer.titles = settings.titles || {};
					$Printer.coverTitle = settings.coverTitle;

					let title_target = $('#pdf_settings_cover_options input[name="pdf_cover_title"]');
					// по умолчанию
					title_target.val("").attr("placeholder", l10n.print__drawing_album);
					// если есть значение
					let name = $(".pdf_settings_cover_item.active").attr('data-name');

					if ($Printer.titles && name && $Printer.titles[name]) {
						title_target.val($Printer.titles[name]);
					} else if ($Printer.coverTitle) {
						title_target.val($Printer.coverTitle);
					}

					// Опции масштабирования --------------------------------------------------

					// масштабирование с учетом границ участков
					$Printer.scaleByTerritories = settings.scaleByTerritories;
					$("select[name='scale_by_territories'] option[value='" + $Printer.scaleByTerritories + "']").prop('selected', true);
					// console.log("interface >> scaleByTerritories", $Printer.scaleByTerritories);

					$Printer.scaleByComments = settings.scaleByComments;
					$("#scale_by_comments input").prop('checked', $Printer.scaleByComments);
					// console.log("interface >> scaleByComments", $Printer.scaleByComments);

					$Printer.scaleByRulers = settings.scaleByRulers;
					$("#scale_by_rulers input").prop('checked', $Printer.scaleByRulers);
					// console.log("interface >> scaleByRulers", $Printer.scaleByRulers);

					$Printer.scaleByOuterItems = settings.scaleByOuterItems;
					$("#scale_by_outer_items input").prop('checked', $Printer.scaleByOuterItems);
					// console.log("interface >> scaleByOuterItems", $Printer.scaleByOuterItems);

					$Printer.scaleByFigures = settings.scaleByFigures;
					$("#scale_by_figures input").prop('checked', $Printer.scaleByFigures);
					// console.log("interface >> scaleByFigures", $Printer.scaleByFigures);

					$Printer.scaleByPictures = settings.scaleByPictures;
					$("#scale_by_pictures input").prop('checked', $Printer.scaleByPictures);
					// console.log("interface >> scaleByPictures", $Printer.scaleByPictures);

					// Шрифт заголовка обложки ----------------------------------------------------

					$Printer.coverTitleFontSize = settings.coverTitleFontSize;
					$("select[name='pdf_cover_title_font'] option[value='" + $Printer.coverTitleFontSize + "']").prop('selected', true);
					// console.log("interface >> coverTitleFontSize", $Printer.coverTitleFontSize);

					// Год ------------------------------------------------------------------------

					$Printer.year = settings.year || new Date().getFullYear();
					let year_target = $('#pdf_settings_cover_options input[name="pdf_year"]');
					// по умолчанию
					year_target.val("").attr("placeholder", new Date().getFullYear());
					// если есть значение
					if ($Printer.year) year_target.val($Printer.year);
					// console.log("interface >> year", $Printer.year);
				}

				$("#pdf_settings_tabs .pdf_settings_tab.active").click();

				if ($PrintArea.active == 1) {
					$("#pdf_settings_zone_default").removeClass('active');
					$("#pdf_settings_zone_ready").addClass('active');
				}
				if ($PrintArea.active == 0) {
					$("#pdf_settings_zone_ready").removeClass('active');
					$("#pdf_settings_zone_default").addClass('active');
				}
			}
			if (method === 'hotkeys') {
				try {
					$ShortKeys.build_modal();
				} catch (e) {}
			}
			set_v2_modal_height();
		},
	    beforeSend: function(){
			$("#fog").addClass("sticky");
			if (window.$Fog) {
				$Fog.on();
			} else {
				$("#fog").show();
			}
    	},
	   	error: function(data){
	   		console.log(data);
	    	$("#fog").removeClass("sticky");
			if (window.$Fog) {
				$Fog.off();
			} else {
				$("#fog").hide();
			}
	   	},
		type : "POST"
	});
}


function load_v2_modal_content(method, params = false) {
	$.ajax({
		url: langUrl + '/planner/modal/',
	    cache: false,
	    dataType : "html",
	    timeout: 15000,
	    data: "method=" + method + "&method_params="+params,
	    success: function (data, textStatus) {
			$("#fog").addClass("done");
			$("#fog_window_wrapper").remove();
			$("#canvas_v2_wrapper").append(data);
			set_v2_modal_height();
		},
	    beforeSend: function() {
			$("#fog").removeClass("done");
			$("#fog_window").hide();
    	},
	   	error: function(data) {
	   		console.log(data);
	   	},
		type : "POST"
	});
}

function set_v2_modal_height() {
	wrapper_height = $("#fog_window_wrapper").height();
	max_height = parseInt(wrapper_height) - 40;
	$("#fog_window_content").css("max-height", max_height+"px");
}

function load_v2_modal_from_id(method, is_forced = false) {
	close_v2_modal();
	if (!$("#"+method).length) return false;
	if ($("#fog_window_content #"+method+'_content').length) return false;
	$("#fog").addClass("sticky");
	$("#fog").addClass("done");
	if (window.$Fog) {
		$Fog.on();
	} else {
		$("#fog").show();
	}
	active_modal_from_id = method;
	active_modal_content = $("#"+method).html();
	$("#"+method).html("");
	var content_class = $("#"+method).attr("data-class");

	var content_code = '<div id="fog_window_wrapper" class="'+content_class+'"><div id="fog_window">';
	if (is_forced !== true) {
		content_code+= '<div id="fog_window_close" onclick="return close_v2_modal();">'+l10n.interface_close_modal+'</div>';
	}
	content_code+= '<div id="fog_window_content">'+active_modal_content+'</div></div></div>';

	$("#canvas_v2_wrapper").append(content_code);
	set_v2_modal_height();
}

function load_fullpage_modal_from_id(method) {
	close_v2_modal();
	if (!$("#fullpage_modal_"+method).length) return false;
	$("#fullpage_modal_"+method).show();
}

function close_v2_modal() {
	if (plan === 'shield') {
		if ($('#fog_window_content #electric_shield_not_added_content').length > 0
			|| $('#fog_window_content #electric_shield_restriction_content').length > 0
		) {
			return
		}
	}
	if (active_modal_from_id && $("#"+active_modal_from_id).length) {
		$("#"+active_modal_from_id).html($("#fog_window_content").html());
	}
	$("#fog").removeClass("sticky");
	$("#fog").removeClass("done");
	if (window.$Fog) {
		$Fog.off();
	} else {
		$("#fog").hide();
	}
	$(".fullpage_modal").hide();
	$("#fog_window_wrapper").remove();
}

function send_bugreport(text) {
	let bugreport_data = {};
	bugreport_data.data = project.copy();
	bugreport_data.comment = text;
	$("#planner_report_error").removeClass("active");
	$("#planner_report_body").removeClass("done");
	$("#fog_window_content textarea").blur();
	setTimeout(function(){
		svgAsPngUri(document.getElementById("main_svg")).then(function(uri) {
			bugreport_data.image = uri;
			$.ajax({
				url: '/setup/api/bugreport/?object_id='+$("body").attr("data-object-id")+'&plan_id='+$("body").attr("data-plan_id")+'&authkey='+$("body").attr("data-authkey"),
			    cache: false,
			    timeout: 30000,
			    data: JSON.stringify(bugreport_data),
				contentType: "application/json",
				dataType: "json",
			    success: function (data, textStatus) {
					if (data.result == 'success') {
						close_v2_modal();
						planner_chat_open();
					} else if (data.error_text != 'undefined') {
						$("#fog_window_content textarea").focus();
						$("#planner_report_error").text(data.error_text).addClass("active");
					}
				},
			    complete: function(){
			    	$("#planner_report_body").addClass("done");
			    	$("#fog_window_content textarea").focus();
		    	},
			    error: function(data){
			    	console.log(data);
		    	},
				type : "POST"
			});
		});
	}, 100);
}

function planner_direct_init(directdata) {
	if (!$("#planner_ui_direct").length) {
		return false;
	}
	planner_direct_size();
	planner_direct_open(directdata);
}

function planner_direct_size() {
	if ($(window).width() < 1100) {
		$("#planner_ui_direct").addClass("blocked");
	} else if ($(window).width() < 1400) {
		$("#planner_ui_direct").removeClass("blocked");
		$("#planner_ui_direct").addClass("compact");
	} else {
		$("#planner_ui_direct").removeClass("blocked");
		$("#planner_ui_direct").removeClass("compact");
	}
}

function planner_direct_open(directdata) {
	if (!$("#planner_ui_direct").length) {
		return false;
	}
	if (getCookie('direct_locked')) {
		console.log("direct locked");
		planner_direct_minibanner_open(directdata);
		return true;
	}
	if (!directdata.id) {
		console.log("no direct");
		planner_direct_minibanner_open(directdata);
		return true;
	}
	setTimeout(function(){
		$("#planner_ui_direct").removeClass("minibanner");
		$("#planner_ui_direct").removeClass("closed");
		if ($("#planner_ui_direct").attr("data_id") != directdata.id) {
			$("#planner_ui_direct").attr("data_id", directdata.id);
			$("#planner_ui_direct_content").html(directdata.html);
		} else {
			console.log("direct same id");
		}
	}, 1000);
}

function planner_direct_minibanner_open(directdata) {
	console.log('mini');
	if (!directdata || !directdata.minibanner) {
		console.log('no minibanner id');
		return false;
	}
	
	if (getCookie('direct_mini_locked')) {
		console.log("direct mini locked");
		return false;
	}
	
	setTimeout(function(){
		$("#planner_ui_direct").removeClass("closed");
		$("#planner_ui_direct").addClass("minibanner");
		if ($("#planner_ui_direct").attr("data_id") != directdata.minibanner.id) {
			$("#planner_ui_direct").attr("data_id", directdata.minibanner.id);
			$("#planner_ui_direct_content").html(directdata.minibanner.html);
		} else {
			console.log("direct same id");
		}
	}, 1000);
}

function planner_direct_click() {
	var id = $("#planner_ui_direct").attr("data_id");
	var a = document.createElement('a');
	a.target="_blank";
	a.href='/direct/click/'+id+'/';
	a.click();
}

function planner_direct_close(is_forced) {
	$("#planner_ui_direct").addClass("closed");
	if (is_forced === true) {
		attempts_count = getCookie('direct_close_count');
		
		if (!attempts_count) {
			attempts_count = 0;
		} else {
			attempts_count = parseInt(attempts_count);
		}
		
		if (!$("#planner_ui_functions .planner_ui_function.pro").hasClass("is_pro")) {
			var next_time = 300 + attempts_count*300;
		} else {
			var next_time = 3600 + attempts_count*3600*2;
		}
		
		if ($("#planner_ui_direct").hasClass("minibanner")) {
			var expdate = new Date();
			expdate.setTime(expdate.getTime() + (600*1000));
			setCookie('direct_mini_locked', '1', expdate, '/');
		}
		
		var expdate = new Date();
		expdate.setTime(expdate.getTime() + (3600*24*30*1000));
		setCookie('direct_close_count', attempts_count+1, expdate, '/');
		
		var expdate = new Date();
		expdate.setTime(expdate.getTime() + (next_time*1000));
		setCookie('direct_locked', '1', expdate, '/');
	}
}

function set_planner_guest_mode() {
	$("#save_v2_plan").addClass("guest_mode");
	$("#fog").html("").hide().removeClass("done");
}

function open_help_window(id) {
	close_help_window();
	if(!$(".planner_help_window_wrapper#"+id).length) return false;
	$(".planner_help_window_wrapper#"+id).addClass("active");
}

function close_help_window () {
	$(".planner_help_window_wrapper").removeClass("compact");
	$(".planner_help_window_wrapper").removeClass("active");
}

function close_footer_bar() {
	$("#footer_bar_consultant").removeClass("hidden");
	$("#planner_ui_tools_wrapper").removeClass("hidden");
	$("#footer_bar").removeClass("open");
	$("#footer_bar_folders .footer_bar_folder").removeClass("active");
	$("#footer_bar_content .footer_bar_content").removeClass("active");
	$("#footer_bar_content").css("height", "0px");
	if (plan === 'init' || plan === 'a') {
		// возвращаем инструмент, который был активным до открытия footer_bar
		if (tool_save !== null) {
			tool = tool_save;
			tool_save = null
		}
	}
}

function open_footer_bar(id) {
	$("#footer_bar_consultant").addClass("hidden");
	$("#planner_ui_tools_wrapper").addClass("hidden");
	$("#footer_bar .footer_bar_comment").removeClass("expandUp");
	$("#footer_bar_tools .footer_bar_tool").removeClass("active");
	$("#footer_bar .footer_bar_tip_wrapper").removeClass("visible");
	$("#footer_bar_folders .footer_bar_folder").removeClass("active");
	$("#footer_bar_folders .footer_bar_folder.dir_"+id).addClass("active");
	$("#footer_bar_content .footer_bar_content").removeClass("active");
	$("#footer_bar_content .footer_bar_content.tab_"+id).addClass("active");
	$("#footer_bar_content").css("height", $("#footer_bar_content .footer_bar_content.tab_"+id).outerHeight()+"px");
	$("#footer_bar").addClass("open");
	$(".planner_help_window_wrapper.active").addClass("compact");
	tool_save = tool;
	tool = 'none';
	$('body').css('cursor', 'default');
}

function init_navi_bar() {
	if ($("#planner_ui_functions").length) {
		var margin_left = parseInt($("#planner_ui_functions").outerWidth());
		if ($("#planner_header").css("z-index") != '100001') {
			$("#planner_header").css("left", margin_left+"px");
		}
	}
	
	var current = $("#groups_navi .groups_navi_item.active");
	var wrapper = $("#groups_navi");
	if (!wrapper.length) return false;
	if (!current.length) init_active_tools();
	var current = $("#groups_navi .groups_navi_item.active");
	let window_width = $("#groups_navi_wrapper").width();

	if (current.length && (current.offset().left) > window_width*0.80)
	{
		var half = window_width/2 - current.outerWidth()/2;
		var left_offset = parseInt(half - current.position().left);
		var max_offset = window_width - (wrapper.width()-0);
		if (max_offset > left_offset-100) left_offset = max_offset;
		if (left_offset > 0) left_offset = 0;
		if ($("#planner_header").css("z-index") != '100001') {
			wrapper.css("left", left_offset+"px");
		}
	}

	if (current.length && (current.offset().left) < window_width*0.80)
	{
		var half = window_width/2 - current.outerWidth()/2;
		var left_offset = parseInt(half - current.position().left);
		if (left_offset > -100) left_offset = 0;
		if ($("#planner_header").css("z-index") != '100001') {
			wrapper.css("left", left_offset+"px");
		}
	}

	if ($("#planner_header").css("z-index") != '100001') {
		setTimeout(function(){
			init_navi_arrows();
		}, 300);
	}

	check_tools_placement();
}

function navi_next(go_to_active_plan = false)
{
	if ($("#planner_header").css("z-index") == '100001') {
		$("#groups_next").slideUp(300);
		$("#groups_navi").animate({scrollTop: $("#groups_navi")[0].scrollHeight + 'px'}, 300);
		//$("#groups_navi").scrollTop($("#groups_navi")[0].scrollHeight);
		return false;
	}
	var wrapper = $("#groups_navi");
	let window_width = $("#groups_navi_wrapper").width();
	var left_offset = wrapper.position().left - parseInt(window_width/2);
	var max_offset = window_width - (wrapper.width()-0);
	if (max_offset > left_offset-100) left_offset = max_offset;

	if ($("#groups_navi_wrapper .groups_navi_item.active").length) {
		var active_offset = parseInt(($("#groups_navi_wrapper .groups_navi_item.active").position().left) / 1);
	} else {
		var active_offset = parseInt(($("#groups_navi_wrapper .groups_navi_item").eq(0).position().left) / 1);
	}
	if (go_to_active_plan === true) {
		final_offset = - active_offset + parseInt(window_width/2);
		if (final_offset > 0) {
			final_offset = 0;
		}
		max_final_offset = window_width-wrapper.width();
		if (final_offset < max_final_offset && window_width < wrapper.width()) {
			final_offset = max_final_offset;
		}
		if (window_width >= wrapper.width()) {
			final_offset = 0;
		}
	} else {
		final_offset = left_offset;
	}

	wrapper.css("left", final_offset+"px");
	setTimeout(function(){
		init_navi_arrows();
	}, 300);
}

function navi_prev()
{
	var wrapper = $("#groups_navi");
	let window_width = $("#groups_navi_wrapper").width();
	var left_offset = wrapper.position().left + parseInt(window_width/2);
	if (left_offset > -100) left_offset = 0;
	wrapper.css("left", left_offset+"px");
	setTimeout(function(){
		init_navi_arrows();
	}, 300);
}

function init_navi_arrows(terminate = false)
{
	if (!$("#groups_navi_wrapper").length) return false;
	let window_width = $("#groups_navi_wrapper").width();
	var first_child = $("#groups_navi .groups_navi_item:first-child");
	if (first_child.offset().left != $("#groups_navi_wrapper").offset().left) {
		$("#groups_prev").addClass("active");
	} else {
		$("#groups_prev").removeClass("active");
	}

	var last_child = $("#groups_navi .groups_navi_item:last-child");
	var current = Math.floor(last_child.offset().left+last_child.outerWidth());

	if ($("#planner_ui_functions").length) {
		current = current - parseInt($("#planner_ui_functions").outerWidth());
	}

	if (current > window_width) {
		$("#groups_next").addClass("active");
	} else {
		$("#groups_next").removeClass("active");
	}

	if (!terminate) {
		setTimeout(function(){
			// console.log('init_navi_arrows');
			init_navi_arrows(true);
		}, 500);
	}
}

var current_plan = false;

// to delete (old functions)
function show_tracker(plan){};
function next_track(){};
function force_planner_track(ind = false){};
function remove_planner_track(ind = false){};
function ui_open_help(plan = false, button = false){};
function ui_open_designer_help(button = false){};

function deactivate_current_tool_menuitem(toolname = false) {
	if (!toolname) $(".tools_item.active").removeClass('active');
	$(".options_preset").removeClass("slideFastLeft");
}

tool_events.scroller_closed = 0;
tool_events.tool_selection = 0;
function set_scroller(element, height) {
	if (!$(element).length) return false;
	$(element).slimScroll({
		height: height+'px',
		railVisible: true,
		size: '4px',
		distance: '3px',
		color: '#e68506',
		railColor: '#000',
		opacity: 1,
		railOpacity: 0.3,
		wheelStep: 14,
		touchScrollStep: 24,
		disableFadeOut: true,
		alwaysVisible: false
	});
	$(element).scroll(function() {
		//console.log(tool_events.scroller_closed);
		if (tool_events.scroller_closed < 10 && $("#planner_ui_guide_scroll_menu").hasClass("active")) {
			$("#planner_ui_guide_scroll_menu").removeClass("active");
			tool_events.scroller_closed++;
		} else if (tool_events.scroller_closed >= 10) {
			//console.log('die');
			$("#planner_ui_guide_scroll_menu").remove();
		}
	});
}

function check_tools_placement() {
	if ($("#planner_ui_tools").length) {
		//$("#planner_ui_tools_scroller").slimScroll({destroy: true});
		//$(".scroller").slimScroll({destroy: true});
		$(".slimScrollBar, .slimScrollRail").remove();
		$(".slimScrollDiv").contents().unwrap();

		$("#planner_ui_tools_scroller").css("max-height", "auto");
		$("#planner_ui_tools_scroller").css("height", "auto");

		var max_height = parseInt($("#canvas_wrapper").height()) - 80;
		var tools_height = parseInt($("#planner_ui_tools_scroller").outerHeight());

		if (tools_height >= max_height && !$("#planner_ui_tools_wrapper").hasClass("compact")) {
			$("#planner_ui_tools_wrapper").addClass("compact");
		}

		var max_height = parseInt($("#canvas_wrapper").height()) - 80;
		var tools_height = parseInt($("#planner_ui_tools_scroller").outerHeight());

		if (tools_height+90 < max_height) {
			$("#planner_ui_tools_wrapper").removeClass("compact");
			var max_height = parseInt($("#canvas_wrapper").height()) - 90;
			var tools_height = parseInt($("#planner_ui_tools_scroller").outerHeight());
			if (tools_height >= max_height) {
				$("#planner_ui_tools_wrapper").addClass("compact");
			}
		}

		var max_height = parseInt($("#canvas_wrapper").height()) - 80;
		var tools_height = parseInt($("#planner_ui_tools_scroller").outerHeight());

		if (tools_height >= max_height) {
			$("#planner_ui_tools_scroller").css("height", "auto");
			$("#planner_ui_tools_scroller").css("max-height", max_height+"px");
			set_scroller("#planner_ui_tools_scroller", tools_height);
		} else {
			$("#planner_ui_tools_scroller").css("max-height", "10000px");
			$("#planner_ui_tools_scroller").css("height", "auto");
		}

		set_scroller(".scroller", tools_height);
	}
}

last_active_subtool = false;
last_active_plan = false;

function open_subtools_wrapper(target) {
	$(".planner_ui_subtools").removeClass("active");
	var wrapper = $(".planner_ui_subtools[data-parent='"+target+"']");
	if (!wrapper.length) return false;

	set_last_active_subtool(target);
	last_active_plan = plan;

	wrapper.siblings(".planner_ui_subtools").find(".subtools_group").removeClass("active");
	
	var width = parseInt($("#planner_ui_tools").outerWidth());
	var this_width = parseInt(wrapper.outerWidth());

	if ($("#planner_ui_tools_wrapper").hasClass("adaptive")) {
		width = 39;
	}

	if ($("#planner_ui_tools_wrapper").hasClass("has_memory") || $("#planner_ui_tools_wrapper").hasClass("adaptive")) {
		parent_tool_item = $("#planner_ui_tools_wrapper .tools_item[data-target='"+target+"']");
		if (!parent_tool_item.hasClass("active")) {
			parent_tool_item.addClass("active");
		}
	}

	$(".slimScrollBar, .slimScrollRail").fadeOut(0);

	wrapper.css("left", width+"px");
	wrapper.addClass("active");
	if ($("#planner_ui_guide_scroll_menu").length) {
		var last_item = wrapper.find(".scroller").children('.subtools_item:last-child');
		if (last_item.length) {
			if (wrapper.height() <= last_item.position().top) {
				$("#planner_ui_guide_scroll_menu").addClass("active");
				if ($("#planner_ui_guide_scroll_menu").hasClass("mini")) {
					$("#planner_ui_guide_scroll_menu").css("width", "40px");
				} else {
					$("#planner_ui_guide_scroll_menu").css("width", (this_width-2)+"px");
				}
			} else {
				$("#planner_ui_guide_scroll_menu").removeClass("active");
			}
		}
	}
	set_subtools_width();
}

function set_last_active_subtool(value) {
	last_active_subtool = value;
}

function close_subtools_wrapper() {
	$("#planner_ui_guide_scroll_menu").removeClass("active");
	$("#planner_ui_tools_wrapper .planner_ui_subtools").removeClass("active");
	if ($("#planner_ui_tools_wrapper").hasClass("adaptive") ) {
		var width = parseInt($("#planner_ui_tools").outerWidth());
		$("#planner_ui_tools_wrapper").css("width", width+"px");
	}
}

function set_subtools_width() {
	wrapper = $(".planner_ui_subtools.active");
	if (!wrapper.length) return false;
	var width = parseInt($("#planner_ui_tools").outerWidth());
	var this_width = parseInt(wrapper.outerWidth());
	if ($("#planner_ui_tools_wrapper").hasClass("adaptive")) {
		width = 39;
	}
	$("#planner_ui_tools_wrapper").css("width", width+this_width+"px");
}

function set_change_group(first_item, active_item)
{
	if (!active_item.length) {
		var current_cookie = getCookie('active_plan_name');
		if (current_cookie) {
			change_group(current_cookie, true);
		} else {
			change_group(first_item.attr("data-plan"), true);
		}

	} else {
		change_group(active_item.attr("data-plan"));
	}
}

function init_active_tools()
{
	set_plans_interface_mode();
	set_plans_angles_mode();
	set_plans_mm_rounded();
	var first_item = $("#groups_navi_wrapper .groups_navi_item").eq(0);
	var active_item = $("#groups_navi_wrapper .groups_navi_item.active");
	if (!$("#canvas_v2_wrapper").length) return false;

	if (window.planner_version === 3) return false;

	if (window.app_load) {

		set_change_group(first_item, active_item);

	} else {

		window.wait_load_app = setInterval(function () {
			if (window.app_load) {
				clearInterval(window.wait_load_app);
				set_change_group(first_item, active_item);
			}
		}, 500);
	}
}

function click_on_navi_group_from_cookie() {
	var name = getCookie('active_plan_name');
	if (name) click_on_navi_group(name);
}

function click_on_navi_group(name) {
	//$("#groups_navi_wrapper .groups_navi_item[data-plan='"+name+"']").click();
}

function send_save_reqeust() {
	$("#footer_bar_save_status .save_status").removeClass("active");
	$("#footer_bar_save_status .save_status.loading").addClass("active");
}

function save_project_from_fog() {
	$("#fog .fog_done_wrapper").remove();
	$("#fog").removeClass("done");
	project.save(false, true);
}

function plan_length_elements() {
	return plan_length_walls() + plan_length_items() + plan_length_pillars() + plan_length_doors();
}

function plan_length_walls() {
	if (window.planner_version && window.planner_version === 3.0) {
		return WALLS ? WALLS.length() : 0;
	} else {
		return walls && walls.db ? walls.db.length : 0;
	}
}

function plan_length_items() {
	if (window.planner_version && window.planner_version === 3.0) {
		return ITEMS ? ITEMS.length() : 0;
	} else {
		return items && items.db ? items.db.length : 0;
	}
}

function plan_length_pillars() {
	if (window.planner_version && window.planner_version === 3.0) {
		return PILLARS ? PILLARS.length() : 0;
	} else {
		return pillars && pillars.db ? pillars.db.length : 0;
	}
}

function plan_length_doors() {
	if (window.planner_version && window.planner_version === 3.0) {
		let doors = 0;
		if (WALLS) {
			for (let i in WALLS) {
				if (WALLS[i].holes) {
					for (let j in WALLS[i].holes) {
						if (WALLS[i].holes[j].group === 'doors') {
							doors++;
						}
					}
				}
			}
		}
		return doors;
	} else {
		return doors && doors.db ? doors.db.length : 0;
	}
}

function plan_length_windows() {
	if (window.planner_version && window.planner_version === 3.0) {
		let windows = 0;
		if (WALLS) {
			for (let i in WALLS) {
				if (WALLS[i].holes) {
					for (let j in WALLS[i].holes) {
						if (WALLS[i].holes[j].group === 'windows') {
							windows++;
						}
					}
				}
			}
		}
		return windows;
	} else {
		return windows && windows.db ? windows.db.length : 0;
	}
}

function plan_length_rooms1() {
	if (window.planner_version && window.planner_version === 3.0) {
		return ROOMS1 ? ROOMS1.length() : 0;
	} else {
		return rooms1 && rooms1.data ? rooms1.data.length : 0;
	}
}

function plan_length_rooms2() {
	if (window.planner_version && window.planner_version === 3.0) {
		return ROOMS2 ? ROOMS2.length() : 0;
	} else {
		return rooms2 && rooms2.data ? rooms2.data.length : 0;
	}
}

function plan_create_rooms1() {
	if (window.planner_version && window.planner_version === 3.0) {
		ROOMS1.get();
	} else {
		rooms1.create();
	}
}

function plan_create_rooms2() {
	if (window.planner_version && window.planner_version === 3.0) {
		ROOMS2.draw();
	} else {
		rooms2.create();
	}
}

function planner_ui_message_open(id) {
	planner_ui_message_close();
	element = $(".planner_ui_message#"+id);
	if (!element.length) {
		return false;
	}
	element.addClass('viewed');
	var element_width = (element.outerWidth()/2);
	var element_height = (element.outerHeight()/2);
	element.css("margin-left", "-"+element_width+"px");
	element.css("margin-top", "-"+(element_height+30)+"px");
	element.addClass("active");
	$("#planner_ui_message_fog, #switch_help_guide").addClass("active");
}

function planner_ui_message_close() {
	$(".planner_ui_message.active").removeClass("active")
	$("#planner_ui_message_fog, #switch_help_guide").removeClass("active");
}

tool_events.wall_drawing = 0;
tool_events.esc_guide_closed = 0;
tool_events.wallpoint_selected = 0;
tool_events.rulers = 0;
tool_events.freelines = 0;
tool_events.comments = 0;
function planner_guide_show() {
	if (!$(".planner_ui_guide").length || $("#footer_guest_alert").length) return false;
	if (plan_length_walls() > 0 && tool_events.wall < 1) {
		tool_events.wall = 1;
	}

	if (!$("#set_help_switch").hasClass("active") && !$("#preplan_promo_video").hasClass("disabled")) {
		$("#preplan_promo_video").addClass("disabled");
	} else if ($("#set_help_switch").hasClass("active") && $("#preplan_promo_video").hasClass("disabled")) {
		$("#preplan_promo_video").removeClass("disabled");
	}
	
	if (tool_events.comments > 0) {
		$("#comments").next(".footer_bar_tip_wrapper").remove();
	}

	if (tool_events.rulers > 0) {
		$("#rulers").next(".footer_bar_tip_wrapper").remove();
	}
	
	if (tool_events.wall_drawing) {
		$(".planner_ui_guide").removeClass("active");
		$("#planner_ui_guide_wrapper").removeClass("active");
		$("#planner_container").addClass("wall_drawing_mode");	
		return false;
	} else {
		if ($("#planner_container").hasClass("wall_drawing_mode")) {
			$("#planner_container").removeClass("wall_drawing_mode");
		}
	}
	
	if (!$("#set_help_switch").hasClass("active") && !$("#canvas_v2_wrapper").hasClass("background_mode") && plan != 'projections') {
		$(".planner_ui_guide").removeClass("active");
		$("#planner_ui_guide_wrapper").removeClass("active");
		if ($("#planner_ui_socials").length) {
			if (plan == 'a' || plan == 'b' || plan == 'c') {
				$("#planner_ui_socials").hide();
			} else {
				$("#planner_ui_socials").show();
			}
		}
		return false;
	} else {
		$("#planner_ui_socials").hide();
	}
	
	if ($(".planner_ui_message.tool_"+tool).length && !$(".planner_ui_message.tool_"+tool).hasClass("viewed")) {
		element_id = $(".planner_ui_message.tool_"+tool).attr('id');
		planner_ui_message_open(element_id);
		return false;
	}

	if ($("#canvas_v2_wrapper").hasClass("background_mode")) {
		$(".planner_ui_guide").removeClass("active");
		$("#planner_ui_guide_clear_background").addClass("active");

		if ($("#canvas_v2_wrapper").hasClass("background_mode_active")) {
			$("#planner_ui_guide_walls").addClass("active");
		} else if ($("#planner_ui_guide_walls").hasClass("active")) {
			$("#planner_ui_guide_walls").removeClass("active");
		}
		
		return false;
	} else if ($("#planner_ui_guide_clear_background").hasClass("active")) {
		$("#planner_ui_guide_clear_background").removeClass("active");
	}
	
	if (plan_length_rooms2() < 1 && plan_length_rooms1() < 1 && plan_length_walls() > 3) {
		$("#pug_rooms").addClass("active");
	} else if ($("#pug_rooms").hasClass("active")) {
		$("#pug_rooms").removeClass("active");
	}

	if ((plan === 'a' || plan === 'c') && plan_length_walls() > 0 && plan_length_rooms2() < 1 && (tool == 'none' || tool == 'wall')) {
		$("#pug_edit_walls").addClass("active");
	} else if ($("#pug_edit_walls").hasClass("active")) {
		$("#pug_edit_walls").removeClass("active");
	}

	if ((plan === 'a' || plan === 'c') && plan_length_walls() < 1) {
		$("#pug_start").addClass("active");
		if (tool_events.click_wo_wall !== 'undefined'
			&& tool_events.click_wo_wall > 1
			&& !$("#pug_start").hasClass("aggressive")
		) {
			$("#pug_start").addClass("aggressive");
		}
	} else if ($("#pug_start").hasClass("active")) {
		$("#pug_start").removeClass("active");
		$("#pug_start").removeClass("aggressive");
	}

	if ((plan === 'a') && (!tool_events.wall || tool_events.wall < 4) && tool != 'wall' && plan_length_walls() < 3) {
		$("#planner_ui_guide_walls").addClass("active");
	} else if ($("#planner_ui_guide_walls").hasClass("active")) {
		$("#planner_ui_guide_walls").removeClass("active");
	}

	if (plan === 'c' && tool == 'wall' && plan_length_walls() < 3 && !$("#pum_start_plan").hasClass("viewed")) {
		planner_ui_message_open('pum_start_plan');
	}

	if ((tool_group == 'walls' || tool_group == 'sockets' || tool_group == 'doors' || tool_group == 'lights')
		&& tool_events.wall > 0
		&& tool_events.esc_guide_closed < 2
		&& plan_length_walls() > 0
		&& tool != 'air'
	) {
		$("#planner_ui_guide_esc").addClass("active");
		if (tool == 'pillar' || tool == 'air' || tool == 'pillar_air' || tool_group == 'doors' || tool_group == 'walls') {
			$("#planner_ui_guide_esc").addClass("with_modal");
			if (tool_group == 'walls') {
				$("#planner_ui_guide_esc").addClass("high");
			}
		} else if ($("#planner_ui_guide_esc").hasClass("with_modal")) {
			$("#planner_ui_guide_esc").removeClass("with_modal").removeClass("high");
		}
	} else if ($("#planner_ui_guide_esc").hasClass("active")) {
		tool_events.esc_guide_closed++;
		$("#planner_ui_guide_esc").removeClass("active");
	}

	if ((!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) {
		if ((plan === 'init' || plan === 'a') && (tool == 'none' || tool == 'wall') && !getCookie('guestures_guide_closed')) {
			$("#planner_ui_guide_guestures").addClass("active");
		} else if ($("#planner_ui_guide_guestures").hasClass("active")) {
			$("#planner_ui_guide_guestures").removeClass("active");
		}
	}

	if ((plan === 'a' || plan === 'c') && (tool_group == 'doors' || tool_group == 'windows')
		&& (plan_length_doors()+plan_length_windows()) < 2) {
		$("#pug_doors").addClass("active");
	} else if ($("#pug_doors").hasClass("active")) {
		$("#pug_doors").removeClass("active");
	}

	if (tool_group == 'doors' && plan_length_doors() > 0 && plan_length_doors() < 3) {
		$("#pug_doors_opening").addClass("active");
	} else if ($("#pug_doors_opening").hasClass("active")) {
		$("#pug_doors_opening").removeClass("active");
	}
	
	if (plan == 'b' && plan_length_items() < 10) {
		$("#pug_demount").addClass("active");
		$("#pug_demount_cancel").addClass("active");
	} else if ($("#pug_demount").hasClass("active")) {
		$("#pug_demount").removeClass("active");
		$("#pug_demount_cancel").removeClass("active");
	}
	
	if (!$("#planner_is_embedded").length && (plan == 'a' || plan == 'c' || plan == 'furniture' || plan == 'santeh')) {
		$("#planner_ui_guide_keys").addClass("active");
	} else if ($("#planner_ui_guide_keys").hasClass("active")) {
		$("#planner_ui_guide_keys").removeClass("active");
	}
	
	if (plan == 'furniture' || plan == 'santeh' && plan_length_items() < 10) {
		$("#pug_furniture").addClass("active");
	} else if ($("#pug_furniture").hasClass("active")) {
		$("#pug_furniture").removeClass("active");
	}

	if (tool == 'delimiter'
		|| tool == 'zone_c'
		|| tool == 'zone_ceiling'
		|| tool == 'zone_floor'
		|| tool == 'zone_hydroisolation'
		|| tool == 'zone_floor_cap'
	) {
		$("#pug_zone").addClass("active");
	} else if ($("#pug_zone").hasClass("active")) {
		$("#pug_zone").removeClass("active");
	}
	
	if (plan == 'rooms') {
		$("#pug_rooms_name").addClass("active");
	} else if ($("#pug_rooms_name").hasClass("active")) {
		$("#pug_rooms_name").removeClass("active");
	}
	
	if ((plan == 'a' || plan == 'c') && (plan_length_rooms1() > 0 || plan_length_rooms2() > 0) && tool == 'none') {
		$("#pug_rooms_height").addClass("active");
	} else if ($("#pug_rooms_height").hasClass("active")) {
		$("#pug_rooms_height").removeClass("active");
	}

	if ((plan == 'furniture' || plan == 'santeh') && plan_length_items() < 10) {
		$("#pug_turn").addClass("active");
	} else if ($("#pug_turn").hasClass("active")) {
		$("#pug_turn").removeClass("active");
	}
	
	if (plan == 'sockets') {
		$("#pug_sockets").addClass("active");
	} else if ($("#pug_sockets").hasClass("active")) {
		$("#pug_sockets").removeClass("active");
	}
	
	if (plan == 'light_connections') {
		$("#pug_switches").addClass("active");
	} else if ($("#pug_switches").hasClass("active")) {
		$("#pug_switches").removeClass("active");
	}
	
	if ((plan == 'light_connections' || plan == 'sockets') && plan_length_rooms2() > 0) {
		$("#pug_height_from_floor, #pug_sockets_groups").addClass("active");
	} else if ($("#pug_height_from_floor, #pug_sockets_groups").hasClass("active")) {
		$("#pug_height_from_floor, #pug_sockets_groups").removeClass("active");
	}

	if ((plan === 'init' || plan === 'a')
		&& (tool == 'none' || plan_length_walls() > 1)
		&& (!tool_events.canvas_zoom || tool_events.canvas_zoom < 3)
		&& plan_length_items() < 3
	) {
		$("#planner_ui_guide_zoom").addClass("active");
	} else if ($("#planner_ui_guide_zoom").hasClass("active")) {
		$("#planner_ui_guide_zoom").removeClass("active");
	}

	if (plan === 'a' && $("#planner_ui_guide_wrapper .planner_ui_guide_element.active:not(#pug_move)").length < 2) {
		$("#pug_move").addClass("active");
	} else if ($("#pug_move").hasClass("active")) {
		$("#pug_move").removeClass("active");
	}
	
	if (plan === 'a' && tool == 'wall') {
		$("#planner_ui_direct").addClass("hidden");
	} else if ($("#planner_ui_direct").hasClass("hidden") && !$("#planner_chat_wrapper").hasClass("active")) {
		$("#planner_ui_direct").removeClass("hidden");
	}

	if ($("#planner_ui_guide_wrapper .planner_ui_guide_element.active").length) {
		$("#planner_ui_guide_wrapper").addClass("active");
		if ($("#planner_ui_guide_wrapper .planner_ui_guide_element.active").length < 3 && plan != 'projections') {
			$("#pug_video").addClass("visible");
		} else if ($("#pug_video").hasClass("visible")) {
			$("#pug_video").removeClass("visible");
		}
	} else if ($("#planner_ui_guide_wrapper").hasClass("active")) {
		$("#planner_ui_guide_wrapper").removeClass("active");
		$("#pug_video").removeClass("visible");
	}
}

function planner_ui_close_guestures() {
	attempts_count = getCookie('guestures_guide_close_counter');
	if (!attempts_count) {
		attempts_count = 0;
	} else {
		attempts_count = parseInt(attempts_count);
	}
		
	var expdate = new Date();
	expdate.setTime(expdate.getTime() + (3600*24*30*1000));
	setCookie('guestures_guide_close_counter', attempts_count+1, expdate, '/');
	
	var expdate = new Date();
	if (attempts_count > 1) {
		expdate.setTime(expdate.getTime() + (3600*24*30*1000));
		setCookie('guestures_guide_closed', '1', expdate, '/');
	}
	
	$("#planner_ui_guide_guestures").remove();
}

function focus_file_input() {
	$("#file-input").click();
}

function set_plans_interface_mode(forced_value = false) {
	if (forced_value !== true) {
		current_value = getCookie('compact_mode');
	} else {
		current_value = $("#settings_plans_ui").val();
	}

	if (current_value == 1) {
		$("#settings_plans_ui").val(1);
		$("#groups_navi_wrapper").addClass("compact");
	} else {
		$("#settings_plans_ui").val(0);
		$("#groups_navi_wrapper").removeClass("compact");
	}

	setTimeout(function(){
		navi_next(true);
	}, 150);
}

function set_plans_angles_mode() {

	// delCookie('angles_mode');

	let val = getCookie('angles_mode');
	if (val == null) {
		var expdate = new Date();
		expdate.setTime(expdate.getTime() + (3600*24*30*1000));
		setCookie('angles_mode', "on", expdate, '/');
	}
	if (val == "on") $("#settings_plans_angles").val(1);
	if (val == "off") $("#settings_plans_angles").val(0);
}

function set_plans_mm_rounded() {
	$("#settings_plans_mm_rounded").val(localStorage.settings_plans_mm_rounded ? 1 : 0);
}

$(document).on('click', '.button-delete_background', function(e) {

	if (!confirm(l10n.are_you_sure)) {
		return;
	}

	$("#canvas_v2_wrapper").removeClass("background_mode_active");
	$("#canvas_v2_wrapper").removeClass("background_mode");
	window.background_image_loaded = false;
	window.background_image_move = false;
	$('.button-move_background').removeClass('active');
	console.log('background_image_loaded false');
	project.background.fire('delete');
	scale_recognition_rect_tool.fire('delete');
	scale_recognition_line_tool.fire('delete');
	if (plan === 'init' || plan === 'break' || plan === 'a' || plan === 'b') {
		plan_create_rooms1();
		console.log('rooms1.create');
	} else {
		plan_create_rooms2();
		console.log('rooms2.create');
	}
	$("#planner_ui_direct").removeClass("hidden");
	$("#planner_ui_guide_clear_background").removeClass("active");
	close_help_window();
	localStorage.removeItem('background_image_mode');
	localStorage.removeItem('background_image_object_id');
	localStorage.removeItem('background_image_plan_id');
	if (window.$StoreDB) {
		$StoreDB.delete('settings', 'background_image');
	}
});

$(document).on('click', '.button-hide_background', function(e) {

	let button = $("#planner_ui_guide_clear_background .button-hide_background");
	let status = button.hasClass('active');

	if (status == 1) {
		background_image_loaded = false;
		button.removeClass('active');
		project.background.hide();
		localStorage.background_image_mode = 'hide';
		$("#planner_ui_guide_clear_background .button-move_background").hide();
		$("#planner_ui_guide_clear_background .button-reset_background").hide();
	} else {
		background_image_loaded = true;
		button.addClass('active');
		project.background.show();
		localStorage.background_image_mode = 'show';
		$("#planner_ui_guide_clear_background .button-move_background").show();
		$("#planner_ui_guide_clear_background .button-reset_background").show();
	}

	if (plan === 'init' || plan === 'break' || plan === 'a' || plan === 'b') {
		plan_create_rooms1();
	} else {
		plan_create_rooms2();
	}
});

$(document).on('click', '.button-move_background', function(e) {
	if (!window.background_image_move) {
		window.background_image_move = true;
		$(this).addClass('active');
		project.background.IMAGE.draggable(true);
		project.background.IMAGE_POLYGON.attr({'stroke': '#000000', 'stroke-width': 1});
	} else {
		window.background_image_move = false;
		$(this).removeClass('active');
		project.background.IMAGE.draggable(false);
		project.background.IMAGE_POLYGON.attr({'stroke': 'none', 'stroke-width': 0});
	}
});

$(document).on('click', '.button-reset_background', function(e) {

	if (!confirm(l10n.are_you_sure)) {
		return;
	}

	preplan_scale(1);

	$("#preplan_scale").prop("data-type", "2");
	open_help_window('preplan_scale');
});

function background_mode_signal() {
	object_id = $("body").attr("data-object-id");
	$.ajax({
		url: '/setup/api/signal/',
	    cache: false,
	    dataType : "html",
	    timeout: 10000,
	    data: "object_id="+object_id+"&ind=background_mode",
	    success: function (data, textStatus) {	
			console.log(data);
		},
		error: function (data, textStatus) {
		   	console.log(data);
		},
		type : "POST"
	});
}

function show_thickness_tip() {
	if ($("#thickness_tip").length) {
		$("#thickness_tip").parent(".contextmenu_item_icon").addClass("show_tip");
	}
}
function hide_thickness_tip() {
	if ($("#thickness_tip").length) {
		$("#thickness_tip").parent(".contextmenu_item_icon").removeClass("show_tip");
	}
}

$(window).resize(function() {
	if (!$("body").hasClass("resizing")) {
		$("body").addClass("resizing");
		setTimeout(function() {
			init_navi_bar();
			planner_direct_size();
			$("body").removeClass("resizing");
		}, 500);
	}
	show_extended_tools();
});

function stopPrntScr() {
	console.log('stopPrntScr');
	var inpFld = document.createElement("input");
	inpFld.setAttribute("value", ".");
	inpFld.setAttribute("width", "0");
	inpFld.style.height = "0px";
	inpFld.style.width = "0px";
	inpFld.style.border = "0px";
	document.body.appendChild(inpFld);
	inpFld.select();
	document.execCommand("copy");
	inpFld.remove(inpFld);
}

function open_actionmenu(id) {
	var menu_item = $(".planner_actionmenu#"+id);
	if (!menu_item.length) {
		return false;
	}
	$(".planner_actionmenu").removeClass("expandUp");
	offset_top = parseInt(menu_item.outerHeight()/2)+30;
	offset_left = parseInt(menu_item.outerWidth()/2);
	console.log(offset_left);
	menu_item.css("margin-top", "-"+offset_top+"px");
	menu_item.css("margin-left", "-"+offset_left+"px");
	menu_item.addClass("expandUp");
}

function close_actionmenu() {
	$(".planner_actionmenu").removeClass("expandUp");
}

function show_extended_tools(inner_cycle = false, forced_element = false) {
	if (!inner_cycle) {
		$("#planner_ui_tools_scroller > .tools_item.is_extended").addClass("hidden");
		if (forced_element) {
			$("#planner_ui_tools_scroller > .tools_item.is_extended.extended"+forced_element).removeClass("hidden");
		}
		$("#extended_tools_button").removeClass("hidden").addClass("active");
	}
	var elements = $("#planner_ui_tools_scroller > .tools_item.is_extended.hidden");
	if (!elements.length) {
		if ($("#extended_tools_button").length) {
			$("#extended_tools_button").addClass("hidden").removeClass("active");
		}
		return false;
	}
	var element = elements.eq(0);
	var navi_height = $("#planner_ui_tools_wrapper").outerHeight();
	var container_height = $("#planner_container").outerHeight();
	var rest_height = container_height - navi_height - 60;
	if (rest_height > 70) {
		element.removeClass("hidden");
		show_extended_tools(true);
	}
}

function set_extended_toolset(id) {
	$("#planner_ui_tools_scroller > .tools_item.is_extended").addClass("hidden");
	$("#planner_ui_tools_scroller > .tools_item.is_extended.extended"+id).removeClass("hidden");
	$("#extended_tools_modal_items .extended_tools_modal_item").removeClass("active");
	$("#extended_tools_modal_items .extended_tools_modal_item.item"+id).addClass("active");
	show_extended_tools(false, id);
	setTimeout(function() {
		$("#planner_ui_tools_scroller > .tools_item.is_extended.extended"+id).trigger("click");
	}, 200);
	close_v2_modal();
	var expdate = new Date();
	expdate.setTime(expdate.getTime() + (3600*24*30*1000));
	setCookie('extended_toolset', id, expdate, '/');
}

function planner_load_new() {

	if (!window.was_mousemove) {
		return;
	}

	$.ajax({
		type: 'GET',
		url: langUrl + '/setup/api/planner/new/',
		data: {
			object_id: $("body").attr("data-object-id"),
			plan_id: $("body").attr("data-plan_id"),
			authkey: $("body").attr("data-authkey"),
			plan: window.plan,
		},
		dataType: "json",
		success: function (data) {
			if (data.reload) {
				if (data.reload === 101) {
					window.location = langUrl + '/client/?out=1';
				} else {
					window.location.reload();
				}
				return;
			}
			if (data.status === 'success') {
				if (data.chat_new_messages == 1
					&& $("#jivo_custom_widget").length
					&& !$("#planner_chat_wrapper").hasClass('active')
				) {
					planner_chat_open();
				}
				if (data.direct && $("#planner_ui_direct").length) {
					planner_direct_init(data.direct);
				}
				try {
					if (data.s_backup_br == 1 && window.$PlanBackup) {
						sleep(100).then(_ => $PlanBackup.to_server());
					}
				} catch (e) { }
			}
		},
	});

	window.was_mousemove = 0;
}

$(window).keyup(function(e) {
	if (e.keyCode == 44) {
		if (!$("body").hasClass("admin_interface") && !$("#planner_ui_functions .pro").hasClass("is_pro") && !$("#planner_header").hasClass("demo")) {
			$("#canvas_v2_wrapper").append("<div id='blur_fog'><span>"+l10n.interface_protection+"</span></div>");
			navigator.clipboard.writeText(l10n.interface_screenshot);
			stopPrntScr();
			
			setTimeout(function() {
				try {
	                console.log('clipboardData');
					window.clipboardData.setData('text', l10n.interface_screenshot);
	            } catch (err) {}
            }, 100);
            
			console.log('screenshot!');
			setTimeout(function() {
				$("#blur_fog").remove();
			}, 500);
		}
	}
	if (e.keyCode == 27) {
		close_v2_modal();
	}
}); 

$(window).focus(function() {
	if (!$("body").hasClass("admin_interface") && !$("#planner_ui_functions .pro").hasClass("is_pro") && !$("#planner_header").hasClass("demo")) {
		$("#blur_fog").remove();
	}
}).blur(function() {
	if (!$("body").hasClass("admin_interface") && !$("#planner_ui_functions .pro").hasClass("is_pro") && !$("#planner_header").hasClass("demo")) {
		$("#canvas_v2_wrapper").append("<div id='blur_fog'><span>"+l10n.interface_protection+".</span></div>");
	}
});

item_search_value = '';
function item_search_activate(value) {
	if (!$("#item_search_wrapper").length) return false;
	if (value.length > 2) {
		$("#item_search_wrapper input").siblings("span").addClass("active");
	} else {
		$("#item_search_wrapper input").siblings("span").removeClass("active");
	}
	item_search_value = value;
}

function item_search_start() {
	if (!$("#item_search_wrapper").length || !$("#item_search_submit").hasClass("active")) return false;
	$.ajax({
		url: langUrl + '/planner/item_search/',
	    cache: false,
	    dataType : "html",
	    timeout: 15000,
	    data: "search_value="+item_search_value,
	    success: function (data, textStatus) {	
			$("#item_search_results").html(data);
		},
	    beforeSend: function (data, textStatus) {	
			$("#item_search_wrapper").addClass("loading");
		},
	    complete: function (data, textStatus) {	
			$("#item_search_wrapper").removeClass("loading");
		},
		error: function (data, textStatus) {
		   	console.log(data);
		},
		type : "POST"
	});
}

function item_search_pro() {
	close_v2_modal();
	load_v2_modal_from_id('pro_tools_modal');
}

function item_search_open(plan, root_id, item_id, sub_item_id) {
	//console.log(root_id+'/'+item_id+'/'+sub_item_id);
	var plan_object = $("#groups_navi .groups_navi_item[data-plan='"+plan+"']");
	if (plan_object.length && !plan_object.hasClass("active")) {
		change_group(plan, true);
	}
	if (root_id) {
		$("#planner_ui_tools_wrapper .toolid"+root_id).trigger("click");
	}
	if (sub_item_id) {
		$("#planner_ui_tools_wrapper .toolid"+sub_item_id).trigger("click");
	}
	if (item_id) {
		if ($("#planner_ui_tools_wrapper .toolid"+item_id).parent(".subtools_group").length) {
			if (!$("#planner_ui_tools_wrapper .toolid"+item_id).parent(".subtools_group").hasClass("active")) {
				$("#planner_ui_tools_wrapper .toolid"+item_id).trigger("click");
			}
		} else {
			$("#planner_ui_tools_wrapper .toolid"+item_id).trigger("click");
		}
	}
	close_v2_modal();
}

function save_settings(key, value) {
	try {

		$.ajax({
			url: '/setup/api/planner/save_settings/',
			data: {
				object_id: $("body").attr("data-object-id"),
				key: key,
				value: value,
			},
			type : 'POST',
		});
	} catch (e) {
	}
}

function init_settings_menu() {

	let settings = {
		'settings_sockets_height': tools
		&& tools['socket']
		&& tools['socket'].over_floor
		&& tools['socket'].over_floor.value !== undefined ? tools['socket'].over_floor.value : 30,
		'settings_electric_box_wall_height': tools
		&& tools['electric_box_wall']
		&& tools['electric_box_wall'].over_floor
		&& tools['electric_box_wall'].over_floor.value !== undefined ? tools['electric_box_wall'].over_floor.value : 30,
	};

	for (let name in settings) {

		let input = $('#settings_opener input.numeric[name="' + name + '"]');

		if (input) {

			let value;
			let value_default = settings[name];

			if (localStorage[name] !== undefined) {
				value = localStorage[name];
			} else {
				value = value_default;
			}

			input.val(LIB.lengthForContextmenu(value, 1));
		}
	}
}

$(function() {
	
	init_navi_bar();
	item_search_activate(false);

	$(document).on('change', '#config_pdf_plans input', function(e) {
		var current_value = $(this).is(':checked');
		if (current_value) {
			$("#pdf_settings_plans .pdf_settings_plan#config_pdf_plans_current input").prop('checked', false);
			$("#pdf_settings_plans #config_pdf_columns .pdf_settings_plan").addClass("hidden");
			$("#config_pdf_columns").addClass("hidden");
		} else {
			$("#pdf_settings_plans #config_pdf_columns .pdf_settings_plan").removeClass("hidden");
			$("#config_pdf_columns").removeClass("hidden");
		}
	});

	$(document).on('change', '#pdf_settings_font_scale select', function(e) {
		var current_value = $(this).val();
		if (current_value == 'manual') {
			$("#pdf_settings_font_scale").addClass("manual");
			$("select[name='pdf_cover_title_font_size'] option[value='" + 8 + "']").prop('selected', true);
		} else {
			$("#pdf_settings_font_scale").removeClass("manual");
		}
	});

	$(document).on('change', '#config_pdf_plans_current input', function(e) {
		var current_value = $(this).is(':checked');
		if (current_value) {
			$("#pdf_settings_plans #config_pdf_columns .pdf_settings_plan").addClass("hidden");
			$("#config_pdf_columns").addClass("hidden");
			$("#pdf_settings_plans .pdf_settings_plan#config_pdf_plans input").prop('checked', false);
			$("#pdf_settings_plans .pdf_settings_plan#config_projections input").prop('checked', false);
			$("#pdf_settings_plans .pdf_settings_plan#config_pdf_plans-split_cables input").prop('checked', false);
			$("#pdf_settings_plans .pdf_settings_plan#config_pdf_plans__scale_by_territories input").prop('checked', false);
		}
		else {
			$("#pdf_settings_plans #config_pdf_columns .pdf_settings_plan").removeClass("hidden");
			$("#config_pdf_columns").removeClass("hidden");
		}
	});

	$(document).on('click', '#pdf_settings_cover a', function(e) {
		if ($("#pdf_settings_cover_items").hasClass("disabled")) {
			return false;
		}
		$(this).parent("div").addClass("active");
		$(this).parent("div").siblings("div").removeClass("active");
		if ($(this).parent("div").is(':first-child')) {
			$("#pdf_settings_cover_options").hide();
		} else {
			$("#pdf_settings_cover_options").show();
		}
	});

	$(document).on('click', '#pdf_settings_tabs .pdf_settings_tab', function(e) {
		$(this).siblings("div").removeClass("active");
		$(this).addClass("active");
		var tab_type = $(this).attr("data-type");
		$("#fog_window_content .tabbed").hide(0);
		$("#fog_window_content .tabbed.tab_"+tab_type).show(0);
		if ($("#config_pdf_columns").css("display") == 'block') {
			$("#config_pdf_columns").css("display", "flex");
		}

		if (tab_type == 'decoration') {
			if ($("#pdf_settings_cover .pdf_settings_cover_item.active").is(':first-child')) {
				$("#pdf_settings_cover_options").hide();
			} else {
				$("#pdf_settings_cover_options").show();
			}
		}

		set_v2_modal_height();
	});

	$("#cancel_mobile_view").click(function(e) {
		$("#footer_mobile_warning").remove();
		$("#container").addClass("mobile_canceled");
	});
	
	$("#save_v2_plan, #planner_ui_save_alert").click(function(e) {
		
		if ($("#canvas").length && !$("#save_v2_plan").hasClass("loading")) {
			if (window.$Fog) {
				$Fog.on(l10n.interface_saving);
			} else {
				$("#fog").show();
			}
			sleep(100).then(function() {
				try {
					// if (plan == "projections") {
					// 	if (plan_ == "projections") {
					// 		$('.projections-close').click();
					// 	}
					// }
					RESET();
				} catch (e) { }
				project.save(false, 2, l10n.interface_saving, {save_client: 1});
			});
		}
	});
	
	$(".planner_ui_guide .planner_ui_guide_close").click(function(e) {
		$(this).parent(".planner_ui_guide").remove();
	});
	$("#eraser").click(function(e) {
		$("#eraser_guide").remove();
	});
	
	$(".planner_ui_guide .planner_ui_guide_button").click(function(e) {
		$(this).parent(".planner_ui_guide").remove();
	});

	$("#switches_opener, #freelines_opener, #settings_opener").click(function(e) {
		init_settings_menu();
		$(this).addClass("open");
	});

	$(document).on('click', '#canvas', function(e) {
		$("#save_v2_plan").removeClass("active").removeClass("loading");
	});
	
	$(document).click(function(event) {
		if (!$(event.target).closest("#fog_window").length && $(event.target).closest("#fog_window_wrapper.close_on_click").length) {
			close_v2_modal();
		}
		
		if (!$(event.target).closest("#measure_units").length) {
			$("#measure_units").removeClass("open");
		}
		if (!$(event.target).closest("#footer_bar_tools .footer_bar_tool.turn").length) {
			$("#footer_bar_tools .footer_bar_tool.turn").removeClass("active");
		}
		if (!$(event.target).closest("#footer_bar_tools .footer_bar_tool.image").length) {
			$("#footer_bar_tools .footer_bar_tool.image").removeClass("active");
		}
		if (!$(event.target).closest("#footer_bar_tools .footer_bar_tool.switch_menu").length) {
			$("#footer_bar_tools .footer_bar_tool.switch_menu").removeClass("open");
		}
		if (!$(event.target).closest("#footer_bar_tools .footer_bar_tool.settings").length) {
			$("#footer_bar_tools .footer_bar_tool.settings").removeClass("open").removeClass("active");
		}
		if (!$(event.target).closest("#footer_bar_tools .footer_bar_tool.pen").length) {
			$("#footer_bar_tools .footer_bar_tool.pen").removeClass("open");
		}
	});
	
	$('#canvas input.numeric').on('input', function() {
		var current = this.value;
		current = current.replace(/[,?\/]/g, '.');
		this.value = current.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
		if ($(this).attr('id') == 'cm-wall--length') {
			if (this.value > 999) {
				$("#wall_mm_alert").addClass("expandOpenNew");
			} else {
				$("#wall_mm_alert").removeClass("expandOpenNew");
			}
		}
	});
	
	$("#footer_bar_tools .footer_bar_tool").mouseenter(function(e) {
		$(this).children(".footer_bar_comment").addClass("expandOpen");
	}).mouseleave(function(e) {
		$(this).children(".footer_bar_comment").removeClass("expandOpen");
	});
		
	$("#footer_bar_tools .footer_bar_tool a").click(function(e) {
		$("#footer_bar_tools .footer_bar_tool").removeClass("active");
		if (!$(this).parent(".footer_bar_tool").hasClass("is_fast")) $(this).parent(".footer_bar_tool").addClass("active");
		close_footer_bar();
	});

	$("#footer_bar_tools .footer_bar_tool.switch").click(function(e) {
		$("#footer_bar_tools .footer_bar_tool").removeClass("active");
		close_footer_bar();
	});

	$("#footer_bar .footer_bar_tip_close").click(function(e) {
		if ($(this).hasClass("close")) {
			$("#footer_bar_tools .footer_bar_tool").removeClass("active");
			$(".footer_bar_tip_wrapper").removeClass("visible");
		}
		else {
			$(this).parent(".footer_bar_tip_wrapper").remove();
		}
	});

	$(document).on('click', '#groups_navi_wrapper .groups_navi_item', function(e) {
		// если кликаем на иконку редактирования произвольного плана, то выходим
		if ($(this).hasClass('custom')
			&& e.target.nodeName === 'SPAN'
			&& e.target.className === 'edit'
		) {
			return;
		}
		$("#planner_header").removeClass("open");
		var plan = $(this).attr("data-plan");
		var href = $(this).attr("href");
		if (href) return true;
		return change_group(plan);
	});

	$("#set_autosave").click(function(e) {
		if ($("#set_autosave_switch").hasClass("active")) {
			$("#set_autosave_switch").removeClass("active");
			setCookie('planner_autosave', 'off', false, '/');
		} else {
			$("#set_autosave_switch").addClass("active");
			setCookie('planner_autosave', 'on', false, '/');
		}
	});
	var autosave = getCookie('planner_autosave');
	if (autosave == 'off') {
		$("#set_autosave_switch").removeClass("active");
	} else if (autosave == 'on') {
		$("#set_autosave_switch").addClass("active");
	}
	
	$("#set_help").click(function(e) {
		if ($("#set_help_switch").hasClass("active")) {
			$("#set_help_switch").removeClass("active");
			setCookie('planner_show_help', 'off', false, '/');
		} else {
			$("#set_help_switch").addClass("active");
			setCookie('planner_show_help', 'on', false, '/');
		}
	});
	var help_switch = getCookie('planner_show_help');
	if (help_switch == 'off') {
		$("#set_help_switch").removeClass("active");
	} else if (help_switch == 'on') {
		$("#set_help_switch").addClass("active");
	}
	
	secondsSinceLastActivity = 0;
	function activity(){
		if (secondsSinceLastActivity > 1800) {
			console.log(secondsSinceLastActivity);
			if ($("#set_autosave_switch").length && $("#set_autosave_switch").hasClass("active")) {
				window.disable_autosave = true;
			}
		}
		secondsSinceLastActivity = 0;
	}
	
	activityEvents = ['mousemove'];
	activityEvents.forEach(function(eventName) {
		document.addEventListener(eventName, activity, true);
	});

	if (!window.fail_load_js_true) {
		setInterval(function(){
			planner_guide_show();
			if (plan_length_walls() > 20 && window.seconds_since_last_save == 300 && !$("#save_v2_plan").hasClass("guest_mode")){
				$("#save_v2_plan").addClass("alert");
			}
			secondsSinceLastActivity++;
			window.seconds_since_last_save++;
		}, 1000);
		if ($("#clientline").hasClass("is_logged")) {
			window.was_mousemove = 0;
			setInterval(planner_load_new, 60000);
		}
	}

	$(document).on('click', '#planner_ui_tools_wrapper .tools_item, #planner_ui_admin .tools_item, #planner_ui_tools_wrapper .subtools_item', function(e) {
		
		if ($(this).hasClass("is_pro") && !$(this).hasClass("group") && !$(this).hasClass("root_group")) {
			console.log('is_pro');
			load_v2_modal_from_id('pro_tools_modal');
			return false;
		}
		
		if (plan_length_walls() && !$(this).hasClass("group")) {
			var save_limit = plan_length_walls()*2;
			if (plan_length_walls() >= 45) save_limit = save_limit * 5;
			else if (plan_length_walls() >= 30) save_limit = save_limit * 3;
			else if (plan_length_walls() >= 15) save_limit = save_limit * 2;
			
			var save_min_limit = 10;
			var save_min_tool_events = 3;
			if (plan_length_elements() >= 10) {
				save_min_limit = 20;
				save_min_tool_events = 5;
			}
			if (plan_length_elements() >= 25) {
				save_min_limit = 30;
				save_min_tool_events = 6;
			}
			if (plan_length_elements() >= 50) {
				save_min_limit = 45;
				save_min_tool_events = 8;
			}
			if (plan_length_elements() >= 100) {
				save_min_limit = 60;
				save_min_tool_events = 10;
			}
			
			//console.log(window.seconds_since_last_save+"/"+save_min_limit+" | "+tool_events.tool_selection+"/"+save_min_tool_events+" || "+plan_length_elements());
			if (window.seconds_since_last_save > save_limit && !$(this).hasClass("has_subtools") && tool_events.tool_selection >= save_min_tool_events
				&& save_limit > 0 && window.seconds_since_last_save > save_min_limit && !$("#save_v2_plan").hasClass("guest_mode")) {
				if ($(".footer_bar_tool.autosave").hasClass("hidden") || $("#set_autosave_switch").hasClass("active")) {
					window.seconds_since_last_save = 0;
					console.log('auto');
					if (window.disable_autosave === true) {
						window.disable_autosave = false;
					} else {
						if (plan_length_elements() >= 50) {
							if (window.$Fog) {
								$Fog.on();
							} else {
								$("#fog").show();
							}
						}
						tool_events.tool_selection = -1;
						sleep(100).then(function() {
							project.save(false, false, l10n.interface_autosaving);
						});
					}
				}
			}
		}
		
		tool_events.tool_selection++;
		close_footer_bar();
		
		if ($(this).hasClass("tools_item") || $(this).hasClass("subtools_item")) 
		{
			if ($(this).hasClass("group")) {
				$(this).parent(".subtools_group").toggleClass("active");
				$(this).parent(".subtools_group").siblings(".subtools_group").removeClass("active");
				set_subtools_width();
				$(".scroller").slimScroll({ scrollTo: $(this).parent(".subtools_group").position().top+'px' });
				return false;
			}
			
			if (!last_active_subtool || $(this).attr("data-target") != last_active_subtool || !$("#planner_ui_tools_wrapper").hasClass("adaptive")) {
				$("#planner_ui_tools_wrapper").css("width", "40px");
				$("#planner_ui_tools_wrapper").removeClass("active");
			}

			if (!$("#planner_ui_tools_wrapper").hasClass("adaptive")) {
				close_subtools_wrapper();
			}

			$(this).addClass("active");


			if ($(this).attr("data-params") && $("#options_preset_"+$(this).attr("data-params")).length) {
				$("#options_preset_"+$(this).attr("data-params")).addClass("slideFastLeft");
			}
		}

		if ($(this).hasClass("tools_item") && !$(this).hasClass("has_subtools")) {
			set_last_active_subtool(false);
			close_subtools_wrapper();
		}

		closed_adaptive_subtool = false;
		if ($("#planner_ui_tools_wrapper").hasClass("adaptive")) {
			if ($(this).hasClass("tools_item") && $(this).hasClass("has_subtools") && $(this).attr("data-target") == last_active_subtool) {
				set_last_active_subtool(false);
				close_subtools_wrapper();
				$(this).removeClass("active");
				closed_adaptive_subtool = true;
			}
		}

		if ($(this).hasClass("has_subtools") && $(this).attr("data-target")) {
			deactivate_current_tool_menuitem();
			if (!closed_adaptive_subtool) {
				$(this).addClass("active");
				open_subtools_wrapper($(this).attr("data-target"));
			}
		}

		$("#planner_ui_tools_label").removeClass("active");
	});
	
	var ui_hover_timeout = null;
	$("#planner_ui_tools_wrapper").mouseenter(function(e) {
		clearTimeout(ui_hover_timeout);
		var width = parseInt($("#planner_ui_tools").outerWidth());
		$(this).css("width", width+"px");
		$("#planner_ui_tools_wrapper .planner_ui_subtools").css("left", width+"px");
		$(this).addClass("active");
		if ($("#planner_ui_tools .tools_item.has_subtools.active").length) {
			open_subtools_wrapper($("#planner_ui_tools .tools_item.has_subtools.active").attr("data-target"));
		} else if ($("#planner_ui_tools_wrapper").hasClass("adaptive") && last_active_subtool && last_active_plan == plan) {
			open_subtools_wrapper(last_active_subtool);
		} else if ($("#planner_ui_tools_wrapper").hasClass("has_memory") && last_active_subtool && last_active_plan == plan) {
			open_subtools_wrapper(last_active_subtool);
		}
	}).mouseleave(function(e) {
		ui_hover_timeout = setTimeout(function() {
			$("#planner_ui_tools_wrapper").css("width", "40px");
			$("#planner_ui_guide_scroll_menu").removeClass("active");
			$("#planner_ui_tools_wrapper").removeClass("active");
		}, 500);
	});

	$("#planner_ui_tools_wrapper.adaptive #planner_ui_tools_scroller > .tools_item").mouseenter(function(e) {
		if ($(this).hasClass("active")) {
			return false;
		}
		if ($("#planner_ui_tools .tools_item.has_subtools.active").length) {
			$("#planner_ui_tools_label").addClass("active");
			var top_offset = parseInt($(this).position().top) + 7;
			$("#planner_ui_tools_label").text($(this).text());
			$("#planner_ui_tools_label").css("top", top_offset+"px");
		}
	}).mouseleave(function(e) {
		$("#planner_ui_tools_label").removeClass("active");
	});

	tools_item_about_hover_timeout = null;
	$(document).on('mouseenter', '.tools_item_about', function(e) {
		this_item = $(this);
		tools_item_about_hover_timeout = setTimeout(function() {
		    var content = this_item.attr("data-text");
		    var image = this_item.attr("data-image");
		    if (content) {
				$("#planner_ui_tools_tooltip_content").text(content);
			} else if (image) {
				var preview = $("<div class='tools-preview'><img alt='' /><span class='preloader'></span><span class='tools_preview_error'>Превью недоступно</span></div>");
				var preview_image = preview.find("img");
				preview_image.one("load", function() {
					preview.addClass("ready");
				}).one("error", function() {
					preview.addClass("failed");
				});
				$("#planner_ui_tools_tooltip_content").empty().append(preview);
				preview_image.attr("src", image);
			} else {
				$("#planner_ui_tools_tooltip_content").text("Описание пока не добавлено");
			}
		    var pageX = this_item.offset().left + 6 + this_item.width();
			var pageY = this_item.offset().top - $("#planner_container").offset().top - 9;
			if (this_item.hasClass("middle")) {
				pageY = pageY - 77;
			}
			$("#planner_ui_tools_tooltip").css("left", pageX).css("top", pageY);
			$("#planner_ui_tools_tooltip").addClass("slideFastDown");
		}, 200);
		
	}).on('mouseleave', '.tools_item_about, #planner_ui_tools_wrapper', function(e) {
		
		clearTimeout(tools_item_about_hover_timeout);
		$("#planner_ui_tools_tooltip_content").text("");
		$("#planner_ui_tools_tooltip").removeClass("slideFastDown");
	});

	window.change_wall_depth_presets = function () {

		if (units == "cm") {
			//defs.wall.depth = LIB.lengthInSystemUnits(10);
			$("#pm-wall--depth").attr("placeholder", LIB.lengthForContextmenu(defs.wall.depth));
			$('#pm-wall--depth-preset-buttons')
				.empty()
				.append(
					'<span><a>5</a></span>' +
					'<span><a>8</a></span>' +
					'<span><a>10</a></span>' +
					'<span><a>12</a></span>' +
					'<span><a>15</a></span>' +
					'<span><a>20</a></span>'
				)
		}
		else if (units == "mm") {
			//defs.wall.depth = LIB.lengthInSystemUnits(100);
			$("#pm-wall--depth").attr("placeholder", LIB.lengthForContextmenu(defs.wall.depth));
			$('#pm-wall--depth-preset-buttons')
				.empty()
				.append(
					'<span><a>50</a></span>' +
					'<span><a>80</a></span>' +
					'<span><a>100</a></span>' +
					'<span><a>120</a></span>' +
					'<span><a>150</a></span>' +
					'<span><a>200</a></span>'
				)
		}
		else if (units == "ft") {
			//defs.wall.depth = LIB.lengthInSystemUnits(4);
			$("#pm-wall--depth").attr("placeholder", LIB.lengthForContextmenu(defs.wall.depth));
			$('#pm-wall--depth-preset-buttons')
				.empty()
				.append(
					'<span><a>2</a></span>' +
					'<span><a>3</a></span>' +
					'<span><a>4</a></span>' +
					'<span><a>5</a></span>' +
					'<span><a>6</a></span>' +
					'<span><a>8</a></span>'
				)
		}
	}

	window.change_ventilation_presets = function () {

		$('#pm-ventilation--width').attr('placeholder', LIB.lengthForContextmenu(defs.ventilation_pipe.width, 1));
		$('#pm-ventilation--height').attr('placeholder', LIB.lengthForContextmenu(defs.ventilation_pipe.height, 1));

		$('#pm-ventilation .opt_preset_buttons span').each(function(index, element) {

			let width = $(element).data('width');
			let height = $(element).data('height');

			if ($(element).hasClass('flat')) {
				$(element).find('a').text(LIB.lengthForContextmenu(width, 1) + ' x ' + LIB.lengthForContextmenu(height, 1));
			}
			if ($(element).hasClass('round')) {
				$(element).find('a').text('Ø' + LIB.lengthForContextmenu(width, 1));
			}
		});
	}

	$("#measure_units .measure_unit").click(function(e) {
		if (!$("#measure_units").hasClass("open")) {
			$("#measure_units").addClass("open");
		} else {
			RESET();
			$('.measure_unit').removeClass('active');
			let val = $(this).attr("data-id");
			$(this).addClass('active');
			$("#measure_units").removeClass("open");
			save_settings('units', val);
			units = val;

			let text_unit = units == "ft" ? "in" : l10n[units];

			// меняем обозначения во всех меню
			$('.project-units').text(text_unit);

			$('#cm-ceiling--size select option').each(function () {
				$(this).text(LIB.lengthForContextmenu($(this).val(), 1) + ' ' + text_unit);
			});

			// шаг перемешения джойстиками
			moving_step_by_key = 1;
			if (units == "mm") moving_step_by_key = .1;
			if (units == "in" || units == "ft") moving_step_by_key = 2.54;

			change_wall_depth_presets();
			change_ventilation_presets();

			if (plan == "projections" && plan_ == "projections") {
				let room = ROOMS2[project.prs.room];
				if (room.PRS !== undefined) {
					room.PRS.draw();
				} else {
					room.prs_draw();
				}
			} else {
				$Project.draw();
			}
		}
	});

	$(document).on('mouseenter', '#groups_navi_wrapper.compact .groups_navi_item', function(e) {
	    $("#modal_hint").remove();
		var content = $(this).html();
		var r = /<(\w+)[^>]*>.*<\/\1>/gi;
		content = content.replace(r,"");
		custom_offset = 18;
	    $("body").append("<div id='modal_hint' class='flipped'>"+content+"</div>");
		var modal_width = $("#modal_hint").outerWidth();
		var object_width = $(this).outerWidth();
		var pageX = $(this).offset().left;
		var pageY = $(this).offset().top;
	    var hintH = $("#modal_hint").outerHeight();
		var hint_left = (pageX+(object_width/2)-modal_width/2);
		if ((hint_left+modal_width) > $(window).width()) {
			hint_left -= parseInt((hint_left+modal_width) - $(window).width());
		}

		$("#modal_hint").css("left", hint_left).css("top", (pageY+hintH+custom_offset));
		$("#modal_hint").addClass("slideFastDown");
	}).on('mouseleave', '#groups_navi_wrapper.compact .groups_navi_item', function(e) {
		$("#modal_hint").remove();
	});

	$("#settings_plans_ui").change(function(e) {
		if ($(this).val() == 1) {
			var expdate = new Date();
			expdate.setTime(expdate.getTime() + (3600*24*30*12*1000));
			setCookie('compact_mode', 1, expdate, '/');
		} else {
			delCookie('compact_mode');
		}
		set_plans_interface_mode(true);
		$("#settings_plans_ui").blur();
	});

	$("#settings_plans_angles").change(function(e) {

		var expdate = new Date();
		expdate.setTime(expdate.getTime() + (3600*24*30*12*1000));
		if ($(this).val() == "1") {
			setCookie('angles_mode', "on", expdate, '/');
		}
		if ($(this).val() == "0") {
			setCookie('angles_mode', "off", expdate, '/');
		}
		set_plans_angles_mode();
		$("#settings_plans_angles").blur();
	});

	$("#settings_plans_mm_rounded").change(function(e) {

		if ($(this).val() == "1") {
			localStorage.settings_plans_mm_rounded = 1;
		} else {
			delete localStorage.settings_plans_mm_rounded;
		}
		set_plans_mm_rounded();
		$("#settings_plans_mm_rounded").blur();
		RESET();
		if (units == "mm") {
			if (plan == "projections" && plan_ == "projections") {
				let room = ROOMS2[project.prs.room];
				if (room.PRS !== undefined) {
					room.PRS.draw();
				} else {
					room.prs_draw();
				}
			} else {
				$Project.draw();
			}
		}
	});

	$('#settings_opener .numeric').on('change', function () {
		let name = $(this).attr('name');
		if (name) {
			let val = LIB.inputValue($(this).val());
			if (val >= 0) {
				val = LIB.lengthInSystemUnits(val);
				localStorage[name] = val;
			}
		}
	});
});
