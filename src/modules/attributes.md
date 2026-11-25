## DESIGN: propertyChangedCallback

1. propertyChangedCallback fires on every assignment, even when oldValue === newValue. Dirty checking is the callback's
   responsibility. This allows signaling in-place mutations of objects/arrays by reassigning the same value.

2. propertyChangedCallback is NOT called for initial values. Everything before setup (preupgrade properties, observing
   and reflecting attributes, defaults, early assignments) is consolidated without calling the propertyChangedCallback.
   This avoids running update functions that depend on multiple properties once per property.

3. Initial shadow and light DOM rendering should be done in setupCallback to access the consolidated properties.

4. Every change made inside setupCallback or later DOES trigger propertyChangedCallback. If you need to normalize props
   concider doing it after rendering.

## DESIGN: setupCallback

1. We use the following precedence:
   - preupgrade properties and properties manually set
   - observed attributes
   - default value in config

2. The precedence is the reason why observe: 'boolean' has no default, a non present attribute means false

3. We need a place to consolidate prop, attr and default values. That can NOT be done in the constructor as it does not
   always allow setAttribute to be called. See: https://dom.spec.whatwg.org/#concept-create-element (search:
   NotSupportedError, "attribute list is not empty")

4. The consolidation is done in the new setupCallback. This method is run either on the connectedCallback or in a task
   (setTimeout) started in the constructor - whichever run first. [SETUP_DONE] is used to ensure setup only runs once.

5. attributeChangedCallback is called for observed attributes before connectedCallback. We must avoid overriding already
   set properties here - as they have a higher precedence. In setupCallback we have to check the existence of attributes
   anyway to know if we should apply defaults. Thats why we use [SETUP_DONE] to stop all automatic attribute reflection
   before the consolidation in setupCallback.

6. el.count = 1; el.setAttribute('count', '2') before setup ends with count === 1

## DESIGN: attr <-> prop syncing

When the config has { observe: 'boolean' | 'string' | 'number' } an attr change updates the class properties When the
config has observe AND { reflect: true } property changes are reflected to the dom attributes

1. we have to prevent a loop to make the DX less surprising and updates more stable FIX: the set [STOP_ATTR_PROP_LOOP]
   has the prop name temporarily added on updates to stop loops

2. this can lead to out of sync attributes relative to the property
   - E.g. numbers: [attr="NaN"] ~> prop=undefined, setting prop again to undefined would remove attribute
   - E.g. boolean: [attr="test"] ~> prop=true, resetting prop would set [attr] without value ""

3. attr ~> prop ~> propertyChangedCallback calls ~> .setAttribute('attr') - does not trigger another prop update

4. attrs change triggers propertyChangedCallback which can normalize the property, that is reflected back to attr
   - E.g. numbers: [attr="-1"] ~> propertyChangedCallback set prop=0 to prevent negative numbers ~> sets [attr="0"]

5. attr ~> prop ~> propertyChangedCallback sets prop2 - which will be reflected to attr2

Points 2 and 3 mean that attrs and props might be out of sync. Which is accepted, but has to be documented
