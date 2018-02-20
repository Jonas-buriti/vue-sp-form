;(function(Vue, $pnp){
	Vue.component('v-select', VueSelect.VueSelect);

	var formTypes = {
		new: 'new',
		edit: 'edit',
		disp: 'disp',
	}
	
	var spFormMixin = {
		methods: {
			getSelectQuery: function(originFields){
				return Object.keys(originFields).map(function(field){
					if(originFields[field].TypeAsString == 'Lookup'){
						return originFields[field].InternalName + '/Id,' + originFields[field].InternalName + '/' + originFields[field].LookupField
					}
					
					return originFields[field].InternalName
				}.bind(this))
			},
			getExpandQuery: function(originFields){
				return Object.keys(originFields).reduce(function(fields, field){
					if(originFields[field].TypeAsString == 'Lookup'){
						fields.push(originFields[field].InternalName + '/Id,' + originFields[field].InternalName + '/' + originFields[field].LookupField)
					}
					return fields
				}.bind(this), [])
			},
		}
	}
	
	Vue.component('form-documento', {
		mixins: [spFormMixin],
		data: function(){
			return {
				listUrl: '/documents',
				pedidosListUrl: '/lists/pedidosdeguarda',
				fields: {},
				pedidoFields: {},
				fieldOverrides: {
					Title: { Hidden: true },
					FileLeafRef: { Hidden: true },
					Regional: { ReadOnlyField: true }, 
					AreaJuridica: { ReadOnlyField: true },
					SerieDocumental: { ReadOnlyField: true },
					Pasta: { ReadOnlyField: true },
					TipoDocumento: { ReadOnlyField: true },
					Produto: { ReadOnlyField: true },
					PedidoGuarda: {
						onChange: this.onChangePedido,
						CustomFilter: ['Status eq \'Pendente\''],
						CustomLabel: 'Pedido',
						ParseLookupData: this.mapPedido
					}
				},
				id: 0,
				pedido: 0,
				moment: moment,
				saving: false,
				pedido:{},
				folderUrl: '',
				fileUrl: ''
			}
		},
		props: {
			type: { required: true }
		},
		created: function(){
			this.pedido = $pnp.util.getUrlParamByName('pedido') || 0
			
			this.loadFields()
				.then(this.loadPedidosFields)
				.then(this.loadPedidoCustomQueries)
				.then(this.initForm)
		},
		methods: {
			initForm: function(){
				if(this.pedido){
					this.loadPedido(this.pedido)
				}
			},
			getSelectPedidos: function(){
				return this.getSelectQuery(this.pedidoFields).concat('Id')
			},
			getExpandPedidos: function(){
				return this.getExpandQuery(this.pedidoFields)
			},
			loadPedidoCustomQueries: function(){
				this.fields.PedidoGuarda.CustomSelect = this.getSelectQuery(this.pedidoFields).concat('Id')
				this.fields.PedidoGuarda.CustomExpand = this.getExpandQuery(this.pedidoFields)
			},
			loadPedido: function(id){
				if(!id) throw 'O id do pedido não foi informado'

				return this.getPedidosList().items.getById(id)
					.select(this.getSelectPedidos())
					.expand(this.getExpandPedidos())
					.get()
					.then(function(pedido){
						this.setPedidoDocumento(this.mapPedido(pedido), true);
					}.bind(this))
			},
			mapPedido: function(pedido){
				pedido.Pedido = [pedido.Title, (pedido.Pasta||{}).Nome].join(' - ')
				return pedido
			},
			setPedidoDocumento: function(pedido, readOnly){
				if(!pedido){
					this.fields.PedidoGuarda.ReadOnlyField = false	
					this.fields.PedidoGuarda.Value = null
					return true
				}
				if(readOnly)
					this.fields.PedidoGuarda.ReadOnlyField = true
					
				this.fields.PedidoGuarda.Value = pedido
				
				Object.keys(pedido).forEach(function(internalName){
					var field = this.getField(internalName, this.fields),
						pedidoField = this.getField(internalName, this.pedidoFields),
						value = pedido[internalName]
					
					if(field){
						if(field.TypeAsString == 'DateTime' && moment(value).isValid){
							value = moment(value).toDate()
						}
						if(field.TypeAsString == 'Lookup' && value.Id){
							Vue.set(field, 'Suggestions', [value])	
						}
						Vue.set(field, 'Value', value)
					}
					if(pedidoField){
						if(pedidoField.TypeAsString == 'DateTime' && moment(value).isValid){
							value = moment(value).toDate()
						}
						if(pedidoField.TypeAsString == 'Lookup' && value.Id){
							Vue.set(field, 'Suggestions', [value])	
						}
						Vue.set(pedidoField, 'Value', value)
					}
				}.bind(this))
			},
			getField: function(internalName, fieldCollection){
				return Object.keys(fieldCollection || []).reduce(function(searchField, field){ 
					if(fieldCollection[field].InternalName == internalName)
						searchField = fieldCollection[field]
					return searchField
				}.bind(this), null)
			},
			validateRequiredFields: function(){
				return !Object.keys(this.fields).some(function(key){
					return !this.fields[key].Value && this.fields[key].Required
				}.bind(this))
			},
			beforeSave: function(){
				this.saving = true
				if(!this.validateRequiredFields()){
					this.saving = false
					return swal("Erro", "Por favor preencha os campos obrigatórios!", "error");
				}
				var folders = [this.getLookupLabel(this.fields.Pasta), this.getLookupLabel(this.fields.TipoDocumento)]

				return this.createAndSetFolderUrl(folders)
					.then(this.uploadFile);
			},
			getLookupLabel: function(field){
				return field.Value[field.LookupField] || ''
			},
			uploadFile: function(){
				this.$refs.fileUploader.uploadFiles()
					.then(function(fileAddResult) {
						this.fileUrl = fileAddResult[0].data.LinkingUri
						var getItem = fileAddResult[0].file.listItemAllFields.fieldValuesAsText.get()
				        return getItem.then(function(item) {
				            return this.save(item.ID, this.getDataToSave())
				        }.bind(this));
				    }.bind(this))
			},
			createAndSetFolderUrl: function(folders){
				return this.createNestedFolders(folders)
					.then(function(){
						Vue.set(this, 'folderUrl', [_spPageContextInfo.webServerRelativeUrl, this.listUrl].concat(folders).join('/'))
					}.bind(this))
			},
			createNestedFolders: function(folders){
				var _self = this
				folders = folders.map(function(folder){
					folder = $.trim(folder)
					return folder
				})
				var createFolder = function(folders, index){
					index = index || 0
					var currentPath = [_spPageContextInfo.webServerRelativeUrl, _self.listUrl].concat(folders.slice(0, index)).join('/'),
						currentFolder = folders[index],
						childFolder = folders[index+1] || null

					return $pnp.sp.web.
						getFolderByServerRelativeUrl(currentPath)
						.folders.add(currentFolder)
						.then(function(result){
							if(childFolder){
								return createFolder(folders, index+1)
							}
						})
				}
				
				return createFolder(folders)
			},
			save: function(id, metadata){
				var call = true
				this.id = id
				if(id){
					call = this.getList().items.getById(id).update(metadata)
				} else {
					call = Promise.resolve()
				}
				return call
					.then(this.afterSave.bind(this))
			},
			afterSave: function(result){
				return this.concluirPedido(this.fields.PedidoGuarda.Value.Id, this.fileUrl)
					.then(function(){
						return swal({
							title: 'Pronto!',
							text: "Documento salvo com sucesso",
							timer: 4000,
							icon: "success"
						}).then(this.cancel)
						this.saving = false
					}.bind(this))
			},
			concluirPedido: function(id, urlDocumento){
				return this.getPedidosList().items.getById(id).update({
					Status: 'Concluído',
					UrlDocumento: urlDocumento
				})
			},
			getDataToSave: function(){
				return Object.keys(this.fields).reduce(function(dataToSave, fieldName){
					var field = this.fields[fieldName];						
					
					if(field.TypeAsString == 'Lookup' && field.Value.Id){
						dataToSave[field.InternalName + 'Id'] = field.Value.Id
					} else {
						dataToSave[field.InternalName] = field.Value || null
					}					
					return dataToSave
				}.bind(this), {})
			},
			cancel: function(){
				SP.UI.ModalDialog.commonModalDialogClose(SP.UI.DialogResult.Cancel)
				window.location.href = $pnp.util.getUrlParamByName('Source') || _spPageContextInfo.webAbsoluteUrl
			},
			getPedidosList: function(){
				return $pnp.sp.web.getList(_spPageContextInfo.webServerRelativeUrl + this.pedidosListUrl)
			},
			getList: function(){
				return $pnp.sp.web.getList(_spPageContextInfo.webServerRelativeUrl + this.listUrl)
			},
			loadFields: function(){
				return this.getList().fields
					.filter('Hidden eq false and ReadOnlyField eq false and InternalName ne \'ContentType\' and InternalName ne \'Attachments\'').get()
					.then(this.transformFields)
					.then(function(fields){
						this.fields = this.applyFieldOverrides(fields)
					}.bind(this))
			},
			loadPedidosFields: function(){
				return this.getPedidosList().fields
					.filter('Hidden eq false and ReadOnlyField eq false and InternalName ne \'ContentType\' and InternalName ne \'Attachments\'').get()
					.then(this.transformFields)
					.then(function(fields){
						this.pedidoFields = fields
					}.bind(this))
			},
			applyFieldOverrides: function(fields){
				return R.mergeDeepRight(fields, this.fieldOverrides)
			},
			transformFields: function(fields){
				return fields.reduce(function(fields, field){
					field.Value = ''
					field.Suggestions = []
					
					fields[field.InternalName] = field
					
					return fields
				}, {})
			},
			onChangePedido: function(pedido){
				pedido = pedido || null
				this.setPedidoDocumento(pedido, false)
			},
			onSelectFile: function(files){
				var file = files[0] || {}
				
				this.fields.Title.Value = file.name || ''
				this.fields.FileLeafRef.Value = file.name || ''
			}
		},
		computed: {
			pedidosAuxFields: function(){
				var auxFields = ['DataDocumento', 'DataVigencia', 'Observacao'];

				return this.pedidoFields ? Object.keys(this.pedidoFields).reduce(function(fields, fieldKey){
					var field = this.getField(fieldKey, this.pedidoFields)
					
					if(field && auxFields.find(function(val){ return val == field.InternalName })){
						field.ReadOnlyField = true
						fields.push(field)
					}
					return fields
				}.bind(this), []) : []
			}
		},
		template: '\
		<div>\
			<h2>Upload de documento</h2>\
			<div class="form-group">\
				<label>Documento *</label>\
				<sp-file-uploader\
					ref="fileUploader"\
					:folder-url="folderUrl"\
					@on-change="onSelectFile">\
				</sp-file-uploader>\
			</div>\
			<!-- FORM ROWS -->\
			<form-row v-for="(field) in fields" :key="field.InternalName" :field="field" />\
			\
			<!-- AUX FORM ROWS -->\
			<form-row v-for="(field) in pedidosAuxFields" :key="field.InternalName" :field="field" />\
			<!--<div class="form-group" v-if="pedidoFields.Title && fields.PedidoGuarda.Title" v-for="field in auxFields">\
				<label>{{ pedidoFields[field].Title }}</label>\
				<input disabled="disabled" class="form-control" type="text" :value="((fields.PedidoGuarda || {}).Value ||{})[field]"/>\
			</div>-->\
			<button :disabled="saving" type="button" class="btn btn-primary" @click="beforeSave">\
				{{ saving ? "Salvando..." : "Salvar" }}\
			</button>\
			<button type="button" class="btn btn-primary" @click="cancel">Cancelar</button>\
		</div>'
	})

	if(document.querySelector('#form-new-documento')){
		new Vue({
			el: '#form-new-documento',
			data: {
				formTypes: formTypes
			},
			template: '<form-documento :type="formTypes.new"/>'
		})
	}
	if(document.querySelector('#form-edit-documento')){
		new Vue({
			el: '#form-edit-documento',
			data: {
				formTypes: formTypes
			},
			template: '<form-documento :type="formTypes.edit"/>'
		})
	}
	if(document.querySelector('#form-disp-documento')){
		new Vue({
			el: '#form-disp-documento',
			data: {
				formTypes: formTypes
			},
			template: '<form-documento :type="formTypes.disp"/>'
		})
	}

})(Vue, $pnp)
