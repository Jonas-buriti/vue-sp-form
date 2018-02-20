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
