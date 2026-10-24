"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const settings=require("../src/settings"),preferences=require("../desktop/preferences");
test("experimental local attachments remain off unless explicitly enabled and survive unrelated saves",()=>{
    const previous=settings.load();
    try{
        settings.save({localAttachmentsExperimental:false});
        assert.equal(preferences.get().localAttachmentsExperimental,false);
        preferences.save({defaultModel:null});
        assert.equal(preferences.get().localAttachmentsExperimental,false);
        preferences.save({localAttachmentsExperimental:true});
        assert.equal(preferences.get().localAttachmentsExperimental,true);
        preferences.save({agentContextChars:15000});
        assert.equal(preferences.get().localAttachmentsExperimental,true);
        preferences.save({localAttachmentsExperimental:false});
        assert.equal(preferences.get().localAttachmentsExperimental,false);
        settings.save({localAttachmentsExperimental:"true"});
        assert.equal(preferences.get().localAttachmentsExperimental,false);
    }finally{settings.save(previous);}
});
