;(function(moment){
  Vue.component('form-row', {
		props: { 
			field: { required: true }
		},
		data: function(){
			return {
				moment: moment
			}
		},
		mixins: [spFormMixin],
		methods: {
			isFunction: function(functionToCheck) {
				return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
			},
			loadLookupSuggestions: function(searchKey, field){
				var call = $pnp.sp.web.lists.getById(field.LookupList).items
				
				if(field.CustomExpand){
					if(this.isFunction(field.CustomExpand))
						field.CustomExpand = field.CustomExpand.call(this)
						
					call = call.expand(field.CustomExpand)
				}
				if(field.CustomSelect){
					if(this.isFunction(field.CustomSelect))
						field.CustomSelect = field.CustomSelect.call(this)		
					
					call = call.select(field.CustomSelect)
				}
			
				return call.get()
					.then(function(results){
						if(field.ParseLookupData){
							results = results.map(field.ParseLookupData)
						}
						Vue.set(field, 'Suggestions', results)
					}.bind(this))
			}
		},
		template: '\
		<div class="form-group" v-show="!field.Hidden">\
			<label>{{ field.Title }}<span v-if="field.Required">*</span></label>\
			<template v-if="field.TypeAsString == \'Lookup\'">\
				<v-select \
					:label="field.CustomLabel || field.LookupField" \
					v-model="field.Value" \
					@search="loadLookupSuggestions($event, field)" \
					:show-autocomplete="true" \
					:options="field.Suggestions"\
					:disabled="field.ReadOnlyField"\
					@input="field.onChange"> \
					<span slot="no-options">Digite um termo válido para carregar opções</span>\
				</v-select>\
			</template>\
			<template v-else-if="field.TypeAsString == \'Choice\'">\
				<v-select \
					v-model="field.Value" \
					:show-autocomplete="true" \
					:options="field.Choices"\
					:disabled="field.ReadOnlyField"> \
					<span slot="no-options">Nenhuma opção encontrada</span>\
				</v-select>\
			</template>\
			<template v-else-if="field.TypeAsString == \'DateTime\'">\
				<v-date-picker\
					v-if="!field.ReadOnlyField"\
					input-placeholder=" "\
					mode="single"\
					v-model="field.Value"\
					:value="Date(field.Value)">\
					<input slot-scope="props" :disabled="field.ReadOnlyField" class="form-control" type="text" :value="props.inputValue"/>\
				</v-date-picker>\
				<input v-else :disabled="field.ReadOnlyField" class="form-control" type="text" :value="moment(field.Value).isValid() ? moment(field.Value).format(\'DD/MM/YYYY\') : \'\'"/>\
			</template>\
			<div v-else-if="field.TypeAsString == \'Boolean\'">\
				<label class="radio-inline">\
					<input :disabled="field.ReadOnlyField" type="radio" v-model="field.Value" :value="true" :name="field.InternalName"/>\
					Sim\
				</label>\
				<label class="radio-inline">\
					<input :disabled="field.ReadOnlyField" type="radio" v-model="field.Value" :value="false" :name="field.InternalName"/>\
					Não\
				\</label>\
			</div>\
			<template v-else-if="field.TypeAsString == \'Note\'">\
				<textarea :disabled="field.ReadOnlyField" class="form-control" rows="3" v-model="field.Value"/>\
			</template>\
			<template v-else>\
				<input :disabled="field.ReadOnlyField" class="form-control" type="text" v-model="field.Value"/>\
			</template>\
		</div>'
	})
})(moment)
