(function jQueryNamespacing($){
	$(function(){
		// for a smooth flowing search input
		var searcherSticker = $("#searcherSticker"), searcherStickerOuterHeight=0,
			coordinatorWrapper = $('#coordinatorWrapper'), coordinatorWrapperTop=0;
							   
		$(window).scroll(function() {
			if($.data(document, 'isCalculating')){
				return true;
			}
			$.data(document, 'isCalculating', true);
			var windowpos = $(window).scrollTop();
			var searcherStickerTopMax = coordinatorWrapperTop + $('#coordinatorWrapper').outerHeight() - searcherStickerOuterHeight;
			if (windowpos >= coordinatorWrapperTop && windowpos < searcherStickerTopMax) {
				searcherSticker.css({position: '', top: ''}); //kill absolute positioning
				searcherSticker.addClass("stick");
			} else if (windowpos >= searcherStickerTopMax){
				searcherSticker.removeClass(); //un-stick
				searcherSticker.css({position: "absolute", top: searcherStickerTopMax + "px"}); //set sticker right above the footer
			} else {
				searcherSticker.removeClass("stick");	
			}
			$.data(document, 'isCalculating', false);
		});
		
		
		// for name searching
		var sendingRequest, treeTimeoutRef;
		var searchProjectNamesUrl = $('#searchProjectNamesUrl').val();
		$('#searcher').on('keyup', function(){
				var searchInput = $(this);
				if(treeTimeoutRef) { clearTimeout(treeTimeoutRef); }
				treeTimeoutRef = setTimeout(function () {
				var v = searchInput.val();
				if(v.length < 3) {return;}
				
				$('#execPlan').jstree(true).search(v);
				
				sendingRequest = $.ajax({
					  url: searchProjectNamesUrl,
					  method: 'GET',
					  data: { q: v },
					  beforeSend: function( xhr ) {
					    if(sendingRequest) {
            				sendingRequest.abort();
        				}
        				$('#searchError').hide();
        				$('#searchLoadingIndicator').show();
    				}
				  })
				.done(function( data, textStatus, jqXHR ) {
					sendingRequest = null;
					if(!data){
						$('#searchError').html('No match').show();
						return true;
					}
					var htmlStr = '';
					for(var i=0; i<data.length; i++){
						htmlStr += '<option value="' + data[i] + '">' + data[i] + '</option>';
					}
					$('#searchResult').html(htmlStr);
				})
				.fail(function( jqXHR, textStatus, errorThrown ) {
					$('#searchError').html(errorThrown).show();
				})
				.always(function( dataOrJqXHR, textStatus, jqXHROrErrorThrown ){ 
					$('#searchLoadingIndicator').hide();
				});
			}, 250);
		
		});
		
		$('#searcherSticker').on('click', '#addProjectBtn', function(){
			
			var selectedItems = $('#searchResult').val();
			if(!selectedItems) return;
			
			var jstreeInst = $.jstree.reference('#execPlan')
			var selectedNodes = jstreeInst.get_selected();
			if(!selectedNodes.length){
				selectedNodes.push('#');	// node selection then to root
			}
			
			for(var i=0; i<selectedNodes.length; i++){
				for(var j=0; j<selectedItems.length; j++){
					jstreeInst.create_node(selectedNodes[i],{text: selectedItems[j]});
				}
			}
			
		})
		
		var checkProjectExistenceUrl = $('#checkProjectExistenceUrl').val();
		var execPlanJsonStrInput = $('input[name="_.executionPlan"]');
		$.post(checkProjectExistenceUrl, 
			// as debug I found that I need to json stringify this checks properties, 
			// otherwise the key-value pair on server side would like sth like {checks['foo']: 'bar', checks['foo0']:'bar0', ...}
			// similar logic lies in apply.js and hudson-behavior.js 
			// buildFormTree(xxx){...  jsonElement.value = Object.toJSON(form.formDom); ...}
			// though method name is `toJSON` it actually return a string for a JSON representative

			{idNameMap: Object.toJSON({foo:'bar'})})
			.done(function( data, textStatus, jqXHR ) {
				//console.info(data);
			})
			.fail(function( jqXHR, textStatus, errorThrown) {
				alert('Jenkins server encountered problems. Please check relevant server log.');
			})
			
		// Since Prototype.js has already polluted Object.toJSON. We won't be able to init jstree via json data turn to HTML data instead
		// var execPlanJson = $.parseJSON(execPlanJsonStrInput.val());
		
		// 'state' plugin is polluted by prototype, do not enable 'state' plugin unless get below snippet enabled
		/* snippet
		originVakataGet = $.vakata.storage.get;
		$.vakata.storage.get = function(key){
			var result = originVakataGet(key);
			result = $.parseJSON(result);
			//console.dir(result);
			return result;
		}
		state plugin is not what we expected, still not get auto-check feature ... */
		
		function customizedMenu(node) {
			var inst = $.jstree.reference(node);
			var nodeType = inst.get_type(node);
			var switchType;
			if(nodeType == 'serial'){
				switchType = 'parallel';
			} else if(nodeType == 'parallel'){
				switchType = 'serial';
			}
			
			var items = $.jstree.defaults.contextmenu.items();
			items.rename.shortcut = 113,
			items.rename.shortcut_label = 'F2';
			
			items.remove.shortcut = 46,
			items.remove.shortcut_label = 'Del';
			if(switchType){
				items['switch'] = {separator_before: true,
							  icon: false,
							  separator_after: false,
							  label: 'Switch ' + switchType[0].toUpperCase(), 
							  action: function(data){
							      var node = inst.get_node(data.reference);
								  inst.set_type(node, switchType);
							  }};
			}
			
			if(inst.is_disabled(node)){
				items['enable'] = {label: 'Enable',
									action: function(data){
											var targets = inst.get_selected();
											if(!targets.length){
												targets = [inst.get_node(data.reference)]
											}
											for(var i=0; i<targets.length; i++){
			    								var node = inst.get_node(targets[i]);
			    								inst.enable_node(inst.get_path(node, undefined, true));
			    								inst.enable_node(node.children_d);				
											}
										}};
			} else {
				items['disable'] = {label: 'Disable',
									action: function(data){
											var targets = inst.get_selected();
											if(!targets.length){
												targets = [inst.get_node(data.reference)]
											}
											for(var i=0; i<targets.length; i++){
			    								var node = inst.get_node(targets[i]);
			    								inst.disable_node(node);
			    								inst.disable_node(node.children_d);
											}
										}};
			}
			
			if(inst.is_leaf(node)){
				items['config'] = {label: 'Configure',
									action: function(data){
										var jobName = inst.get_node(data.reference).text.trim();
										location.href = rootURL + '/job/' + jobName + '/configure';
									}}
			}
			
			if(inst.get_path(node).length == 1){
				// Root should not be deleted
				delete items.remove;
			}
			return items;
		}
		
		$('#execPlan').jstree({plugins: ['checkbox', 'contextmenu', 'dnd', 'search', 'types'/*, 'state'*/],
							// this combination with tie_selection set false is what ui expected
							checkbox: {/*keep_selected_style: false, */whole_node: false, tie_selection: false},
							contextmenu: {select_node: false, items: customizedMenu},
							dnd: {inside_pos: 'last', check_while_dragging: true},
							types: {leaf: {icon: 'coordinator-icon coordinator-leaf'},
									serial: {icon: 'coordinator-icon coordinator-serial'},
									parallel: {icon: 'coordinator-icon coordinator-parallel'}},
							core: {check_callback: function(operation, node, node_parent, node_position, more){
									var inst = $.jstree.reference(node);
									
									if(operation == 'move_node' && !node_parent.parent && node_position != 2){
										// only insert into root, neither before nor after
										// position 2 means inside, 0 before, 1 after 
										return false;
									}

									if(operation == 'delete_node' && !node_parent.parent){
										// Root should not be deleted in multi selection 
										return false;
									}
									return true;
								}}
							})
							.on('ready.jstree', function(){
								var jstreeInst = $.jstree.reference(this);
								// since prototype.js has polluted native JSON relevant methods, might as well do it here 
								jstreeInst.get_container().find('[data-jstree]').each(function(i, e){
									var node = jstreeInst.get_node(e, true);
									var state = node.data().jstree;
									jstreeInst.set_type(e, state.type);
									if(node.hasClass('jstree-leaf') && state.checked){
										jstreeInst.check_node(e);
									}
								});
								coordinatorWrapperTop = coordinatorWrapper.offset().top;
		    					searcherSticker.width(searcherSticker.width());
		    					searcherStickerOuterHeight = searcherSticker.outerHeight();
		    					$(window).scroll();
							})
							.on('create_node.jstree', function(event, data){
								var jstreeInst = data.instance;
								jstreeInst.set_type(data.node, 'leaf');
								if(jstreeInst.get_type(data.parent) === 'leaf'){
									jstreeInst.set_type(data.parent, 'serial');
								}
								jstreeInst.open_node(data.parent); // might as well do so instead of open_all
							})
							.on('paste.jstree', function(event, data){
								var jstreeInst = data.instance;
								for(var i=0; i<data.node.length; i++){
									if(!jstreeInst.get_node(data.node[i].parent).children.length){
										jstreeInst.set_type(data.node[i].parent, 'leaf');
									}
								}
								
								if(jstreeInst.get_type(data.parent) === 'leaf'){
									jstreeInst.set_type(data.parent, 'serial');
								}
								jstreeInst.open_node(data.parent);
							})
							.on('move_node.jstree', function(event, data){
								var jstreeInst = data.instance;
								if(!jstreeInst.get_node(data.old_parent).children.length){
									jstreeInst.set_type(data.old_parent, 'leaf');
								}
								if(jstreeInst.get_type(data.parent) === 'leaf'){
									jstreeInst.set_type(data.parent, 'serial');
								}
								jstreeInst.open_node(data.parent);
							})
							.on('delete_node.jstree', function(event, data){
								var jstreeInst = data.instance;
								if(!jstreeInst.get_node(data.node.parent).children.length){
									jstreeInst.set_type(data.node.parent, 'leaf');
								}
							})
							.on("click.jstree", ".jstree-anchor",function (e) {
								var jstreeInst = $.jstree.reference(e.currentTarget);
								var node = jstreeInst.get_node(e.currentTarget);
								var prevDisabled = node.state.disabled;
								if (jstreeInst.is_disabled(node)){
									// enable the node selection when it's disabled for contextmenu.enable to work
									node.state.disabled = false;
									jstreeInst.activate_node(e.currentTarget, e);
								}
								node.state.disabled = prevDisabled;
							})
		
		function saveExecPlanJsonString(){
			var jstreeInst = $('#execPlan').jstree(true);
			var rootNode = jstreeInst.get_json(null, {no_data: true})[0];
			// from coordinator-utils.js
			optimized4NetworkTransmission(rootNode);
			
			patchUpTreeNode(jstreeInst, rootNode);
			
			// Don't use json.js JSON.stringify! 
			// Here we align with Jenkins convention Prototype.js
			// This Object.toJSON method is defined in Prototype.js within jenkins package
			var jsonString = Object.toJSON(rootNode);
			
			execPlanJsonStrInput.val(jsonString);
		}
		
		// submit seizure
		var form = $('form[action="configSubmit"]').on('submit', function(event){
			
			saveExecPlanJsonString();
			
			var jsonElement = $('input[name="json"]');
			
			// It's for the sake of IE compatibility, 
			// since buildFormTree in hudson-behavior.js get random execution order
			// we should ensure execPlanJsonString is properly collected before form submission
			var formJsonDom;
			try{
				//if collected already, formJson should not be empty
				formJsonDom = $.parseJSON(jsonElement.val());
			} catch(e){
				formJsonDom = undefined;
			}
			
			if(formJsonDom){
				// IE is sth that you cannot image...
				if($.isArray(formJsonDom.builder)){
					formJsonDom.builder[0].executionPlan = jsonString;
				} else {
					formJsonDom.builder.executionPlan = jsonString;
				}
				// execPlanJsonStr not yet collected, but data in form has, we need to patch up
				jsonElement.val(Object.toJSON(formJsonDom));
			}
			return true;
		});
		// handle the situation if the apply button clicked 
		Event.observe(form.get(0), "jenkins:apply", saveExecPlanJsonString);
		
		// Avoid incidently typing "Enter" will trigger submit event in the config page
		var timeoutRef = setTimeout(function removeFormKeyPressedListeners(){
			var listeners = YAHOO.util.Event.getListeners(form.get(0), 'keypress');
			if(listeners){
				YAHOO.util.Event.removeListener(form.get(0), 'keypress', listeners);
				clearTimeout(timeoutRef);
			} else{
				timeoutRef = setTimeout(removeFormKeyPressedListeners, 100);
			}
		}, 100);

	});
})(jQuery.noConflict());