!function(e){var t={};function n(i){if(t[i])return t[i].exports;var r=t[i]={i:i,l:!1,exports:{}};return e[i].call(r.exports,r,r.exports,n),r.l=!0,r.exports}n.m=e,n.c=t,n.d=function(e,t,i){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:i})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var i=Object.create(null);if(n.r(i),Object.defineProperty(i,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var r in e)n.d(i,r,function(t){return e[t]}.bind(null,r));return i},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=15)}([function(e,t){e.exports=require("mongoose")},function(e,t,n){const i=n(0),r=new(0,i.Schema)({name:String,twitchID:String,logo:String,email:String,type:String,broadcaster_type:String,channels:[{channelID:String,achievements:[{aid:Number,earned:Date}],sync:Boolean}],integration:Object,preferences:Object,lastLogin:Date}),s=i.model("user",r);e.exports=s},function(e,t){e.exports=require("express")},function(e,t){e.exports=require("passport")},function(e,t,n){const i=n(0),r=new(0,i.Schema)({owner:String,twitchID:String,theme:String,logo:String,members:Array,icons:{default:String,hidden:String},nextUID:Number}),s=i.model("channel",r);e.exports=s},function(e,t){e.exports=require("cryptr")},function(e,t,n){const i=n(1),r=new(n(5))(process.env.SCK);e.exports={authCheck:(e,t,n)=>{e.user?n():t.redirect("/auth/twitch")},isAuthorized:async(e,t,n)=>{let s=r.decrypt(e.cookies.etid),o=await i.findOne({"integration.twitch.etid":s});o?(e.user=o,t.cookie("etid",e.cookies.etid,{maxAge:144e5,secure:!0,httpOnly:!1,domain:"streamachievements.com"}),n()):(t.clearCookie("etid"),t.status(401),t.redirect(process.env.WEB_DOMAIN))},isAdminAuthorized:async(e,t,n)=>{let s=r.decrypt(e.cookies.etid),o=await i.findOne({"integration.twitch.etid":s});o&&(o.type="admin")?(t.user=o,t.cookie("etid",e.cookies.etid,{maxAge:144e5,secure:!0,httpOnly:!1,domain:"streamachievements.com"}),n()):(t.status(401),t.json({message:"You are not authorized to make this request."}),n())}}},function(e,t,n){const i=n(0),r=new(0,i.Schema)({uid:Number,channel:String,title:String,description:String,icon:String,earnable:Boolean,limited:Boolean,secret:Boolean,listener:String,first:String,earned:Date}),s=i.model("achievement",r);e.exports=s},function(e,t,n){const i=n(0);var r=new(0,i.Schema)({uid:String,token:String,created:Date});r.methods.hasExpired=function(){return Date.now()-Date.parse(this.created)>2592e5};const s=i.model("token",r);e.exports=s},function(e,t,n){const i=n(0),r=i.Schema,s=new r({uid:String,channel:String,achType:String,resubType:String,bot:String,query:r.Types.Mixed,condition:String,achievement:String,aid:Number}),o=i.model("listener",s);e.exports=o},function(e,t,n){const i=n(0),r=new(0,i.Schema)({name:String,type:String,channel:String,cloudID:String,url:String,achievementID:String}),s=i.model("image",r);e.exports=s},function(e,t){e.exports={emitNewChannel:(e,t)=>{let n=e.app.get("ws"),i=e.app.get("IRCSOCKET");console.log(t),n.to(i).emit("new-channel",{name:t.name,"full-access":t["full-access"],connected:!1})},emitNewListener:(e,t)=>{let n=e.app.get("ws"),i=e.app.get("IRCSOCKET");n.to(i).emit("new-listener",t)},emitUpdateListener:(e,t)=>{let n=e.app.get("ws"),i=e.app.get("IRCSOCKET");n.to(i).emit("update-listener",t)},emitRemoveListener:(e,t)=>{let n=e.app.get("ws"),i=e.app.get("IRCSOCKET");console.log(i),n.to(i).emit("remove-listener",t)},emitBecomeGold:e=>{let t=e.app.get("ws"),n=e.app.get("IRCSOCKET");t.to(n).emit("become-gold",{})},emitRemoveGold:e=>{let t=e.app.get("ws"),n=e.app.get("IRCSOCKET");t.to(n).emit("remove-gold",{})},emitAwardedAchievement:(e,t)=>{let n=e.app.get("ws"),i=e.app.get("IRCSOCKET");n.to(i).emit("achievement-awarded",t)},emitAwardedAchievementNonMember:(e,t)=>{let n=e.app.get("ws"),i=e.app.get("IRCSOCKET");n.to(i).emit("achievement-awarded-nonMember",t)},emitTestListener:(e,t)=>{let n=e.app.get("ws"),i=e.app.get("IRCSOCKET");n.to(i).emit("test",t)}}},function(e,t){e.exports=require("axios")},function(e,t,n){const i=n(0),r=new(0,i.Schema)({twitchID:String,name:String,channelID:String,achievementID:String}),s=i.model("queue",r);e.exports=s},function(e,t,n){const i=n(10);let r=n(35).v2;r.config({cloud_name:process.env.CLDNAME,api_key:process.env.CLDKEY,api_secret:process.env.CLDS});e.exports={uploadImage:(e,t,n,s)=>{return new Promise((o,a)=>{i.findOne({name:t,channel:n}).then(c=>{c?(console.log("\nimage already exists"),o(c)):(console.log("\nnew image"),r.uploader.upload(e,(e,r)=>{e?(console.log(e),a({error:e})):(console.log("\nimage uploaded successfully"),new i({name:t,channel:n,cloudID:r.public_id,url:r.url,type:s||"achievement"}).save().then(e=>{console.log("new image in DB"),o(e)}))}))})})},destroyImage:e=>new Promise((t,n)=>{r.uploader.destroy(e,function(e){t(e)})})}},function(e,t,n){e.exports=n(16)},function(e,t,n){(function(e){const t=n(2),i=n(17),r=n(0),s=(n(18),n(3)),o=(n(19),n(20),n(22)),a=n(23),c=n(24).allowAccess,{searchChannels:l}=n(25);let d=n(26),h=n(27),u=n(30);const p=process.env.PORT||5e3;let m=t();m.set("view engine","ejs"),m.use(o()),m.use(a({limit:"50mb",extended:!0})),r.connect(process.env.MDB,{useNewUrlParser:!0},()=>{console.log("connected to mongodb")}),m.use(s.initialize()),m.use(s.session()),m.use(t.static("public")),m.use("/auth",[c],h),m.use("/api",[c],u),m.use(t.static(i.join(e,"client/build")));let g=m.listen(p),f=d.listen(g);m.set("ws",f),f.on("connection",function(e){console.log("connected:",e.client.id),e.on("handshake",function(t){if(t.name="SAIRC")m.set("IRCSOCKET",e.id);else if(t.web){let n=m.get("USERSOCKETS");n?n[t.user]=e.id:((n={})[t.user]=e.id,m.set("USERSOCKETS",n))}}),e.on("search-directory",t=>{console.log(t),l(e,t)}),e.on("disconnect",()=>{console.log("disconnect")})}),console.log(`Express app listening on port ${p}`)}).call(this,"/")},function(e,t){e.exports=require("path")},function(e,t){e.exports=require("cookie-session")},function(e,t,n){const i=n(0),r=new(0,i.Schema)({socketID:String,name:String}),s=i.model("socket",r);e.exports=s},function(e,t,n){const i=n(3),r=n(21).Strategy,s=n(1),o=new(n(5))(process.env.SCK);i.serializeUser((e,t)=>{t(null,e)}),i.use(new r({clientID:process.env.TCID,clientSecret:process.env.TCS,callbackURL:process.env.TPR},(e,t,n,i)=>{let r=o.encrypt(e),a=o.encrypt(t),c={etid:n.id.toString(),token:r,refresh:a};s.findOne({"integration.twitch.etid":c.etid}).then(e=>{e?(e.integration.twitch=c,e.name!==n.login&&(e.name=n.login),e.logo!==n.profile_image_url&&(e.logo=n.profile_image_url),e.email!==n.email&&(e.email=n.email),e.broadcaster_type!==n.broadcaster_type&&(e.broadcaster_type=n.broadcaster_type),e.save().then(t=>{console.log("found user, logging in..."),i(null,e)})):new s({name:n.login,logo:n.profile_image_url,email:n.email,type:"user",channels:[],integration:{twitch:c},preferences:{autojoin:!1}}).save().then(e=>{i(null,e)})})}))},function(e,t){e.exports=require("passport-twitch.js")},function(e,t){e.exports=require("cookie-parser")},function(e,t){e.exports=require("body-parser")},function(e,t,n){e.exports={allowAccess:async(e,t,n)=>{var i;i=["http://www.streamachievements.com","http://streamachievements.com","https://www.streamachievements.com","https://streamachievements.com"];var r=e.headers.origin;i.indexOf(r)>-1&&t.setHeader("Access-Control-Allow-Origin",r),t.header("Access-Control-Allow-Credentials",!0),t.header("Access-Control-Allow-Headers","Origin, X-Requested-With, Content-Type, Accept"),n()}}},function(e,t,n){const i=n(4);e.exports={searchChannels:(e,t)=>{let n=new RegExp(t,"gi");console.log(n),i.find({owner:n}).sort({_id:-1}).limit(25).exec((t,n)=>{console.log(t);let i=n.map(e=>({owner:e.owner,logo:e.logo}));console.log(i),e.emit("channel-results",i)})}}},function(e,t){e.exports=require("socket.io")},function(e,t,n){const i=n(2).Router(),r=n(3),s=n(5),o=n(12),a=new s(process.env.SCK),c=n(6).isAuthorized,l=(n(1),n(4));n(28);let d=n(29),h=d.patreon,u=(0,d.oauth)(process.env.PCID,process.env.PCS);const p="https://www.patreon.com/api/oauth2/v2/identity?include=memberships&fields%5Buser%5D=thumb_url,vanity";i.get("/twitch",r.authenticate("twitch.js",{scope:["user_read","user:read:email"]})),i.get("/twitch/redirect",r.authenticate("twitch.js"),(e,t)=>{e.session.user=e.user;let n=a.encrypt(e.user.integration.twitch.etid);t.cookie("etid",n,{maxAge:144e5,httpOnly:!1,secure:!0,domain:"streamachievements.com"});let i=e.user.integration.patreon;if(i&&"lifetime"!==i.status){let n,{at:r,rt:s,id:c,expires:l}=i;m(l)?(console.log("patreon token expired"),n=new Promise((t,n)=>{g(e.user,i.rt).then(e=>{console.log("token is refreshed"),e&&(r=e.at,s=e.rt,l=e.expires),t()})})):n=Promise.resolve(),n.then(()=>{let n=a.decrypt(r);console.log("getting up to date info from patreon"),console.log(c),console.log(n),o.get(`https://www.patreon.com/api/oauth2/v2/members/${c}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`,{headers:{Authorization:`Bearer ${n}`}}).then(n=>{console.log("up to date info obtained");let o=n.data.data.attributes.patron_status,a=n.data.data.attributes.is_follower,c=n.data.data.relationships.currently_entitled_tiers.data.map(e=>e.id).indexOf("3497710")>=0,d={id:i.id,thumb_url:i.thumb_url,vanity:i.vanity,at:r,rt:s,is_follower:a,status:o,is_gold:c,expires:l},h=Object.assign({},e.user.integration);h.patreon={...d},e.user.integration=h,e.user.lastLogin=Date.now(),e.user.save().then(e=>{t.redirect(process.env.WEB_DOMAIN+"home")})}).catch(e=>{console.log(e.response.data.errors[0]),401===e.response.status&&t.redirect("/auth/patreon")})})}else e.user.lastLogin=Date.now(),e.user.save().then(e=>{t.redirect(process.env.WEB_DOMAIN+"home")})}),i.get("/patreon",c,(e,t)=>{console.log("why tho?");let n="https://www.patreon.com/oauth2/authorize?";n+="response_type=code&",n+="client_id="+process.env.PCID+"&",n+="redirect_uri="+process.env.PPR,n+="&scope=campaigns%20identity%20identity%5Bemail%5D%20campaigns.members",t.redirect(n)}),i.get("/patreon/redirect",c,(e,t)=>{let n=e.query.code;return u.getTokens(n,process.env.PPR).then(t=>{h(t.access_token);let n=e.cookies.etid;return new Promise((e,i)=>{let r,s,c=a.encrypt(t.access_token),l=a.encrypt(t.refresh_token),d=new Date,h=(new Date).setDate(d.getDate()+14);o.get(p,{headers:{Authorization:`Bearer ${t.access_token}`}}).then(i=>{if(r=i.data.data.attributes.vanity,s=i.data.data.attributes.thumb_url,i.data.included){let a=i.data.included[0].id;o.get(`https://www.patreon.com/api/oauth2/v2/members/${a}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`,{headers:{Authorization:`Bearer ${t.access_token}`}}).then(t=>{let i=t.data.data.attributes.patron_status,o=t.data.data.attributes.is_follower,d=t.data.data.relationships.currently_entitled_tiers.data.map(e=>e.id).indexOf("3497710")>=0;e({id:a,thumb_url:s,vanity:r,at:c,rt:l,etid:n,is_follower:o,status:i,is_gold:d,expires:h})})}else e({thumb_url:s,vanity:r,at:c,rt:l,etid:n})})})}).then(n=>{let{id:i,thumb_url:r,vanity:s,at:o,rt:a,etid:c,is_follower:l,status:d,is_gold:h,expires:u}=n,p=Object.assign({},e.user.integration);p.patreon={id:i,thumb_url:r,vanity:s,at:o,rt:a,is_follower:l,status:d,is_gold:h,expires:u},e.user.integration=p,e.user.save().then(e=>{t.redirect(process.env.WEB_DOMAIN+"profile")})})}),i.post("/twitch/sync",c,(e,t)=>{f(e.user,e.cookies.etid).then(e=>{t.json(e)})}),i.post("/patreon/sync",c,(e,t)=>{y(e.user,e.cookies.etid).then(e=>{t.json(e)})}),i.post("/patreon/unlink",c,(e,t)=>{let n=Object.assign({},e.user.integration);delete n.patreon,e.user.integration=n,e.user.save().then(n=>{l.findOne({owner:e.user.name}).then(e=>{e?(e.icons={default:"https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png",hidden:"https://res.cloudinary.com/phirehero/image/upload/v1558811887/hidden-icon.png"},e.save().then(e=>{t.json({success:!0,service:"patreon"})})):t.json({success:!0,service:"patreon"})})})});let m=e=>{let t=new Date(e);return new Date>t},g=(e,t)=>new Promise((n,i)=>{let r=a.decrypt(t);console.log("calling to get a token refresh"),o.post(`https://www.patreon.com/api/oauth2/token?grant_type=refresh_token&refresh_token=${r}&client_id=${process.env.PCID}&client_secret=${process.env.PCS}`).then(t=>{console.log("token obtained");let i=a.encrypt(t.data.access_token),r=a.encrypt(t.data.refresh_token),s=new Date,o=(new Date).setDate(s.getDate()+14),c=Object.assign({},e.integration);c.patreon.at=i,c.patreon.rt=r,c.patreon.expires=o,e.integration=c,e.save().then(e=>{n({at:i,rt:r,expires:o})})}).catch(e=>{n(null)})}),f=(e,t)=>e.integration.twitch?new Promise((t,n)=>{o.get(`https://api.twitch.tv/helix/users/?id=${e.integration.twitch.etid}`,{headers:{"Client-ID":process.env.TCID}}).then(n=>{e.name=n.data.data[0].login,e.logo=n.data.data[0].profile_image_url,e.save().then(e=>{t({username:e.name,logo:e.logo})})})}):Promise.resolve(),y=(e,t)=>e.integration.patreon?new Promise((n,i)=>{let r,{at:s,rt:c,id:l,expires:d}=e.integration.patreon;(r=m(d)?new Promise((t,n)=>{g(e,c).then(e=>{e&&(s=e.at,c=e.rt,d=e.expires),t()})}):Promise.resolve()).then(()=>{let i=a.decrypt(s);o.get(p,{headers:{Authorization:`Bearer ${i}`}}).then(r=>{if(vanity=r.data.data.attributes.vanity,thumb_url=r.data.data.attributes.thumb_url,r.data.included){let a=r.data.included[0].id;o.get(`https://www.patreon.com/api/oauth2/v2/members/${a}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`,{headers:{Authorization:`Bearer ${i}`}}).then(i=>{let r=i.data.data.attributes.patron_status,o=i.data.data.attributes.is_follower,l=i.data.data.relationships.currently_entitled_tiers.data.map(e=>e.id).indexOf("3497710")>=0,h={id:a,thumb_url:thumb_url,vanity:vanity,at:s,rt:c,etid:t,is_follower:o,status:r,is_gold:l,expires:d},u=Object.assign({},e.integration);u.patreon={...h},e.integration=u,e.save().then(e=>{n({vanity:e.integration.patreon.vanity,thumb_url:e.integration.patreon.thumb_url,follower:e.integration.patreon.is_follower,status:e.integration.patreon.status,gold:e.integration.patreon.is_gold})})})}else n({thumb_url:thumb_url,vanity:vanity,at:s,rt:c,etid:t})})})}):Promise.resolve();i.get("/logout",(e,t)=>{e.logout(),t.clearCookie("etid",{domain:"streamachievements.com"}),t.redirect(process.env.WEB_DOMAIN)}),e.exports=i},function(e,t){e.exports=require("url")},function(e,t){e.exports=require("patreon")},function(e,t,n){const i=n(2).Router(),r=n(3),s=n(1),o=n(4),a=n(7),c=n(8),l=n(0);let d=n(31),h=n(36),u=n(39);const{isAuthorized:p,isAdminAuthorized:m}=n(6),{emitTestListener:g,emitNewChannel:f}=n(11);i.use("/channel",d),i.use("/achievement",h),i.use("/irc",u),i.get("/token",r.authenticate("twitch"),(e,t)=>t.json({success:!0,data:e.user.id}));let y=!1;i.get("/users",m,(e,t)=>{c.find({}).then(e=>{let n=e.map(e=>e.uid);s.find({_id:{$in:n}}).then(e=>{let n=e.map(e=>({name:e.name,logo:e.logo}));t.json({users:n})})})}),i.get("/user",p,(e,t)=>{let n;if(setTimeout(()=>{y&&(console.log("timeout"),t.status(500),t.json({message:"Internal Server Issue"}))},1e4),e.user.integration.patreon){let t=e.user.integration.patreon;n={vanity:t.vanity,thumb_url:t.thumb_url,follower:t.is_follower,status:t.status,gold:t.is_gold}}else n=!1;o.findOne({twitchID:e.user.integration.twitch.etid}).then(i=>{if(y=!1,i)t.json({username:e.user.name,logo:e.user.logo,patreon:n,status:"verified",type:e.user.type,preferences:e.user.preferences});else{let i="viewer";console.log(e.user),c.findOne({uid:e.user._id}).then(r=>{console.log(r),r&&(i="not issued"===r.token?"review":"pending"),t.json({username:e.user.name,logo:e.user.logo,patreon:n,status:i,type:e.user.type,preferences:e.user.preferences})})}})}),i.get("/profile",p,(e,t)=>{let n=e.user.channels.map(e=>new l.Types.ObjectId(e.channelID));o.find({_id:{$in:n}}).then(n=>{let i=n.map(t=>{let n=e.user.channels.filter(e=>e.channelID===t.id),i=0;return new Promise((e,r)=>{a.countDocuments({channel:t.owner}).then(r=>{r>0&&(i=Math.round(n[0].achievements.length/r*100)),e({logo:t.logo,owner:t.owner,percentage:i})})})});Promise.all(i).then(n=>{e.user.preferences?t.json({channels:n,preferences:e.user.preferences}):(e.user.preferences={autojoin:!1},e.user.save().then(e=>{t.json({channels:n,preferences:e.preferences})}))})})}),i.post("/profile/preferences",p,(e,t)=>{let n={...e.user.preferences}||{};n={...e.body.preferences},e.user.preferences=n,e.user.save().then(n=>{t.json(e.user.preferences)})}),i.post("/test",m,(e,t)=>{f(e,{name:e.body.channel,"full-access":!1})}),e.exports=i},function(e,t,n){const i=n(2).Router(),{isAuthorized:r,isAdminAuthorized:s}=(n(3),n(6)),o=n(0),a=(new(n(5))(process.env.SCK),n(32)),c=n(33),l=n(34),d=n(1),h=n(4),u=n(7),p=n(9),m=n(10),g=n(8),f=n(13),{uploadImage:y,destroyImage:v}=n(14),{emitNewChannel:w}=n(11),b="https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png",_="https://res.cloudinary.com/phirehero/image/upload/v1558811887/hidden-icon.png",I=/^https:\/\/res\.cloudinary\.com\/phirehero\/.*\.(png|jpg|jpeg)$/gm;i.get("/create",r,(e,t)=>{h.findOne({twitchID:e.user.twitchID}).then(n=>{n?t.json({error:"Channel already exists!",channel:n}):new h({owner:e.user.name,twitchID:e.user.twitchID,theme:"",logo:e.user.logo,achievements:[],members:[],icons:{default:b,hidden:_},nextUID:1}).save().then(n=>{let i=!1;e.user.integration&&e.user.integration.patreon&&("forever"===e.user.integration.patreon.type||e.user.integration.patreon.is_gold)&&(i=!0),w({name:e.user.name,"full-access":i,online:!1}),e.user.channelID=n.id,e.user.save().then(i=>{t.json({channel:n,user:e.user})})})})}),i.post("/leave",r,(e,t)=>{h.findOne({owner:e.body.channel}).then(n=>{if(n){let i,r=n.members;r.length>0&&r.includes(e.user.id)?(i=r.findIndex(t=>{e.user.id}),r.splice(i,1),n.save().then(n=>{i=0,i=e.user.channels.findIndex(e=>e.channelID===n.id),e.user.channels.splice(i,1),e.user.save().then(e=>{t.json({leave:!0})})})):t.send("User isn't a part of this channel")}else t.send("Channel doesn't exist")})}),i.post("/join",r,(e,t)=>{h.findOne({owner:e.body.channel}).then(n=>{if(n){let i=e.user.channels.some(e=>e.channelID===n.id),r=n.members.includes(e.user.id);if(i)r?t.json({user:e.user,channel:n}):(n.members.push(e.user.id),n.save().then(n=>{t.json({user:e.user,channel:n})}));else if(r)i?t.json({user:e.user,channel:n}):(e.user.channels.push({channelID:n.id,achievements:[]}),e.user.save().then(e=>{t.json({user:e,channel:n})}));else{let i={channelID:n.id,achievements:[]};f.find({twitchID:e.user.integration.twitch.etid,channelID:n.id}).then(r=>{r&&r.forEach(e=>{i.achievements.push(e.achievementID),f.deleteOne({_id:e._id})}),e.user.channels.push(i),e.user.save().then(e=>{n.members.push(e.id),n.save().then(n=>{t.json({user:e,channel:n})})})})}}else t.status(405),t.send("Channel requested to join does not exist!")})}),i.get("/list",(e,t)=>{h.find({},(e,n)=>{t.json(n)})}),i.get("/retrieve",r,(e,t)=>{let n=e.query.id;e.query.bb&&h.find({watcher:!0}).then(e=>{e.map(e=>({name:e.owner,listeners:e.listeners}))}),n?h.findOne({owner:n}).then(i=>{i?u.find({channel:n}).then(r=>{let s,o,a=i.members.includes(e.user.id);a?(earnedAchievements=e.user.channels.filter(e=>e.channelID===i.id)[0],s=earnedAchievements.achievements.map(e=>e.aid),o=r.map(e=>{let t=Object.assign({},e._doc),n=s.findIndex(e=>e===t.uid);return n>=0&&(t.earned=earnedAchievements.achievements[n].earned),t})):o=r;let c=o.map(e=>{let t=e._doc?{...e._doc}:e;return delete t.__v,delete t._id,t});d.findOne({name:n}).then(e=>{if(e){let n=!1;e.integration.patreon&&e.integration.patreon.is_gold&&(n=!0);let r={...i._doc};delete r.__v,delete r._id,t.json({channel:r,achievements:c,joined:a,fullAccess:n})}else t.json({error:"Channel doesn't exist"})})}):t.json({error:"No channel found for the name: "+n})}):h.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{if(e){let n=new Promise((t,n)=>{u.find({channel:e.owner}).then(e=>{if(e){let n=e.map(e=>e.listener);p.find({_id:{$in:n}}).then(n=>{let i=e.map(e=>{let t=n.find(t=>t.id===e.listener);if(t){let n={_id:e._id,uid:e.uid,channel:e.owner,title:e.title,description:e.description,icon:e.icon,earnable:e.earnable,limited:e.limited,secret:e.secret,listener:e.listener,code:t.code};return t.resubType&&(n.resubType=t.resubType),t.query&&(n.query=t.query),n}return e});t(i)})}else t(e)})}),i=new Promise((t,n)=>{m.find({channel:e.owner}).then(e=>{t(e?{gallery:e}:{gallery:[]})})}),r=new Promise((t,n)=>{d.find({_id:{$in:e.members}}).then(n=>{let i=n.map(t=>({name:t.name,logo:t.logo,achievements:t.channels.filter(t=>t.channelID===e.id)[0].achievements}));t(i)})});Promise.all([n,i,r]).then(n=>{t.json({channel:e,achievements:n[0],images:n[1],members:n[2]})})}else t.json({error:"User doesn't manage a channel"})})}),i.post("/update",r,(e,t)=>{h.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{})}),i.post("/preferences",r,(e,t)=>{h.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{let i,r;i=new Promise((t,i)=>{e.body.defaultIcon&&l(e.body.defaultIcon)?y(e.body.defaultIcon,e.body.defaultIconName,n.owner,"default").then(e=>{t(e.url)}):e.body.defaultImage&&I.test(e.body.defaultImage)?t(e.body.defaultImage):t()}),r=new Promise((t,i)=>{e.body.hiddenIcon&&l(e.body.hiddenIcon)?y(e.body.hiddenIcon,e.body.hiddenIconName,n.owner,"hidden").then(e=>{t(e.url)}):e.body.hiddenImage&&I.test(e.body.hiddenImage)?t(e.body.hiddenImage):t()}),Promise.all([i,r]).then(e=>{let i={default:n.icons.default,hidden:n.icons.hidden};e[0]&&(i.default=e[0]),e[1]&&(i.hidden=e[1]),n.icons=i,n.save().then(i=>{e[0]!==i.icons.default&&console.log("uh oh"),m.find({channel:n.owner}).then(e=>{e?t.json({channel:i,images:{gallery:e}}):t.json({channel:i})})})})})}),i.post("/image",r,(e,t)=>{let n=e.body.image;v(n.cloudID).then(i=>{let r,s=new Promise((t,i)=>{""!==n.achievementID?u.findOne({_id:n.achievementID}).then(n=>{n?(n.icon="",n.save().then(()=>{u.find({channel:e.user.name}).then(e=>{t(e)})})):t()}):t()}),o=new Promise((t,i)=>{m.deleteOne({_id:n._id}).then(n=>{m.find({channel:e.user.name}).then(e=>{console.log("\nGetting all images after delete"),t(e?{gallery:e,default:""}:{gallery:[],default:""})})})});r="hidden"===n.type||"default"===n.type?new Promise((t,i)=>{h.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{let i={...e.icons};"default"===n.type?i.default=b:"hidden"===n.type&&(i.hidden=_),e.icons=i,e.save().then(e=>{t(e)})})}):Promise.resolve(),Promise.all([s,o,r]).then(e=>{console.log(e);let n={images:e[1]};e[0]&&(n.achievements=e[0]),e[2]&&(n.channel=e[2]),t.json(n)})})}),i.get("/user",r,(e,t)=>{let n=e.user.channels.map(e=>new o.Types.ObjectId(e.channelID));h.find({_id:{$in:n}}).then(n=>{let i=n.map(t=>{let n=e.user.channels.filter(e=>e.channelID===t.id),i=0;return new Promise((e,r)=>{u.countDocuments({channel:t.owner}).then(r=>{console.log(r),r>0&&(i=Math.round(n[0].achievements.length/r*100)),e({logo:t.logo,owner:t.owner,percentage:i})})})});Promise.all(i).then(e=>{t.json(e)})})}),i.post("/signup",r,(e,t)=>{let n=e.body.uid;g.findOne({uid:n}).then(n=>{if(n)t.json({error:"You have already signed up!"});else{new g({uid:e.user._id,token:"not issued"}).save().then(e=>{t.json({signup:!0})})}})}),i.post("/queue",s,(e,t)=>{let n=e.body.uid;g.deleteOne({uid:n}).then(e=>{d.findById(n).then(e=>{e.email;c.createTransport({service:"gmail",auth:{user:process.env.GML,pass:process.env.GMLP}});process.env.GML})})}),i.post("/confirm",s,(e,t)=>{d.findOne({name:e.body.name}).then(e=>{let n=e._id;g.findOne({uid:n}).then(n=>{let i=a.randomBytes(16).toString("hex");n.token=i,n.created=Date.now(),n.save().then(n=>{let r=e.email;var s={type:"oauth2",user:process.env.GML,clientId:process.env.GMLCID,clientSecret:process.env.GMLCS,refreshToken:process.env.GMLRT},o=c.createTransport({service:"gmail",auth:s});const a={from:process.env.GML,to:r,subject:"Your Confirmation Code!",html:'<div style="background:#222938;padding-bottom:30px;"><h1 style="text-align:center;background:#2f4882;padding:15px;margin-top:0;"><img style="max-width:600px;" src="https://res.cloudinary.com/phirehero/image/upload/v1557947921/sa-logo.png" /></h1><h2 style="color:#FFFFFF; text-align: center;margin-top:30px;margin-bottom:25px;font-size:22px;">Thank you for your interest in Stream Achievements!</h2><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We reviewed your channel and feel you are a perfect fit to join in on this pilot, and test the new features we aim to provide for streamers!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">To get started, all you need to do is <a style="color: #ecdc19;" href="http://streamachievements.com/channel/verify?id='+i+'&utm_medium=Email">verify your account</a>, and you\'ll be all set!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We are truly excited to see what you bring in terms of Achievements, and can\'t wait to see how much your community engages!</p></div>'};o.sendMail(a,function(e,n){e?console.log(e):t.json({message:"email sent"})})})})})}),i.post("/verify",r,(e,t)=>{let n=e.body.id;g.findOne({uid:e.user._id,token:n}).then(i=>{i?i.hasExpired()?(g.deleteOne({uid:e.user._id,token:n}).then(e=>{t.json({expired:!0})}),t.json({expired:!0})):new h({owner:e.user.name,twitchID:e.user.integration.twitch.etid,theme:"",logo:e.user.logo,members:[],icons:{default:b,hidden:_},nextUID:1}).save().then(i=>{e.user.channelID=i.id,e.user.status="verified",e.user.save().then(i=>{g.deleteOne({uid:e.user._id,token:n}).then(e=>{t.json({verified:!0})})})}):t.json({error:"Unauthorized"})})}),e.exports=i},function(e,t){e.exports=require("crypto")},function(e,t){e.exports=require("nodemailer")},function(e,t){e.exports=require("valid-data-url")},function(e,t){e.exports=require("cloudinary")},function(e,t,n){const i=n(2).Router(),r=(n(3),n(37)),s=n(12),o=n(1),a=n(4),c=n(7),l=n(9),d=n(13),h=n(38),u=n(10),{isAuthorized:p}=n(6),{emitNewListener:m,emitUpdateListener:g,emitRemoveListener:f,emitAwardedAchievement:y,emitAwardedAchievementNonMember:v}=n(11),w=n(14).uploadImage;n(0);let b=(e,t)=>{let n={_id:e._id,channel:e.owner,title:e.title,description:e.description,icon:e.icon,earnable:e.earnable,limited:e.limited,secret:e.secret,listener:e.listener,achType:t.achType,condition:t.condition};return t.resubType&&(n.resubType=t.resubType),t.query&&(n.query=t.query),n},_=(e,t,n,i,s,o)=>new Promise((a,d)=>{let h;(h=o?new Promise((e,t)=>{u.findOne({achievementID:n._id}).then(t=>{t?(t.achievementID="",t.save().then(()=>{o.achievementID=n._id,o.save().then(t=>{e()})})):(o.achievementID=n._id,o.save().then(t=>{e()}))})}):Promise.resolve()).then(()=>{c.findOneAndUpdate({_id:n._id},{$set:i},{new:!0}).then(i=>{if(Object.keys(s).length>0)if(s.achType&&"3"===s.achType&&i.listener)l.findOne({_id:i.listener}).then(n=>{n&&(f(e,{uid:n.uid,channel:t,achievement:n.achievement,achType:n.achType,resubType:n.resubType,query:n.query,bot:n.bot,condition:n.condition}),l.deleteOne({_id:i.listener}).then(e=>{i.listener=void 0,i.save().then(e=>{a({update:!0,achievement:e})})}))});else if(s.achType&&"3"!==s.achType&&!n.listener){let n={channel:t,uid:r(),...s,achievement:i.id,aid:i.uid};new l(n).save().then(t=>{m(e,{uid:t.uid,channel:t.channel,achievement:t.achievement,achType:t.achType,resubType:t.resubType,query:t.query,bot:t.bot,condition:t.condition}),i.listener=t.id,i.save().then(e=>{a({created:!0,achievement:e})})})}else l.findOneAndUpdate({_id:i.listener},{$set:s},{new:!0}).then(n=>{g(e,{uid:n.uid,channel:t,achievement:n.achievement,achType:n.achType,resubType:n.resubType,query:n.query,bot:n.bot,condition:n.condition});let r=b(i,n);a({update:!0,achievement:r})});else l.findOne({_id:i.listener}).then(e=>{let t=b(i,e);a({update:!0,achievement:t})})})})}),I=e=>new Promise((t,n)=>{u.find({channel:e,type:"achievement"}).then(e=>{if(e){let n={active:[],inactive:[]};e.map(e=>{e.achievementID&&""!==e.achievementID?n.active.push(e):n.inactive.push(e)}),t(n.active.concat(n.inactive))}else t([])})});i.post("/update",p,(e,t)=>{a.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{n?c.findOne({_id:e.body.id,channel:n.owner}).then(i=>{if(i){let r=e.body,{achType:s,resubType:o,query:a,bot:c,condition:l}=r,d={};s&&(d.achType=s,delete r.achType),o&&(d.resubType=o,delete r.resubType),a&&(d.query=a,delete r.query),c&&(d.bot=c,delete r.bot),l&&(d.condition=l,delete r.condition),r.icon&&r.iconName?w(r.icon,r.iconName,n.owner).then(s=>{r.icon=s.url,_(e,n.owner,i,r,d,s).then(e=>{t.json(e)})}):_(e,n.owner,i,r,d).then(e=>{t.json(e)})}else t.json({update:!1,message:"The achievement you tried to update doesn't exist!"})}):t.json({update:!1,message:"The channel you tried to update the achievement for doesn't exist!"})})}),i.post("/create",p,(e,t)=>{a.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{if(n){let i={};e.body.id?i._id=e.body.id:i.title=e.body.title,i.channel=n.owner,c.findOne(i).then(i=>{if(i)t.json({created:!1,message:"An achievement with this name already exists!",achievement:i});else{let i={uid:n.nextUID,channel:n.owner,title:e.body.title,description:e.body.description,icon:e.body.icon,earnable:e.body.earnable,limited:e.body.limited,secret:e.body.secret,listener:e.body.listener},s={channel:n.owner,achType:e.body.achType,uid:r()};"0"!==s.achType&&(s.condition=e.body.condition,"1"===s.achType&&(s.resubType=parseInt(e.body.resubType)),"4"===s.achType&&(s.bot=e.body.bot,s.query=e.body.query)),l.findOne(s).then(r=>{r?c.findOne({listener:r._id}).then(e=>{t.json({created:!1,message:'The conditions you selected are already taken by the "'+e.title+'" achievement!'})}):e.body.icon?w(e.body.icon,e.body.iconName,n.owner).then(r=>{i.icon=r.url,new c(i).save().then(i=>{console.log("new achievement in DB"),s.achievement=i.id,s.aid=i.uid,r.achievementID=i.id,r.save().then(r=>{n.nextUID=i.uid+1,n.save().then(n=>{"3"!==e.body.achType?new l(s).save().then(n=>{m(e,{uid:s.uid,channel:s.channel,achievement:s.achievement,achType:s.achType,resubType:s.resubType,query:s.query,bot:s.bot,condition:s.condition}),i.listener=n.id,i.save().then(e=>{t.json({created:!0,achievement:e})})}):t.json({created:!0,achievement:i})})})})}):new c(i).save().then(i=>{n.nextUID=i.uid+1,n.save().then(n=>{"3"!==e.body.achType?new l(s).save().then(n=>{m(e,{uid:s.uid,channel:s.channel,achievement:s.achievement,achType:s.achType,resubType:s.resubType,query:s.query,bot:s.bot,condition:s.condition}),i.listener=n.id,i.save().then(e=>{t.json({created:!0,achievement:e})})}):t.json({created:!0,achievement:i})})})})}})}else t.json({created:!1,message:"This channel you are creating for doesn't exist!"})})}),i.post("/delete",p,(e,t)=>{a.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{if(n){let i={};i._id=e.body.achievementID,i.channel=n.owner,c.findOne(i).then(r=>{if(r){let s=r.listener;c.deleteOne(i).then(i=>{let o={_id:s,channel:r.channel};l.findOne(o).then(i=>{i?(f(e,{uid:i.uid,channel:n.owner,achievement:i.achievement,achType:i.achType,resubType:i.resubType,query:i.query,bot:i.bot,condition:i.condition}),l.deleteOne(o).then(n=>{u.findOneAndUpdate({achievementID:e.body.achievementID},{$set:{achievementID:""}}).then(e=>{t.json({deleted:!0})})})):u.findOneAndUpdate({achievementID:e.body.achievementID},{$set:{achievementID:""}}).then(e=>{t.json({deleted:!0})})})})}else t.json({deleted:!1,message:"The achievement you requested to delete doesn't exist!"})})}else t.json({delete:!1,message:"This channel you are deleting for doesn't exist!"})})}),i.get("/retrieve",p,(e,t)=>{let n=e.user.name,i=e.query.aid;i?a.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{if(e){let n=new Promise((t,n)=>{c.findOne({uid:i,channel:e.owner}).then(e=>{if(e){e.listener;l.findOne({_id:e.listener,channel:e.channel}).then(n=>{if(n){let i=Object.assign({},n._doc),r=Object.assign({},e._doc);delete i._id;let s=Object.assign(r,i);t(s)}else t(e)})}else t(null)})}),r=I(e.owner);Promise.all([n,r]).then(n=>{t.json({achievement:n[0],images:n[1],defaultIcons:e.icons})})}else t.json({error:"User isn't a verified channel owner"})}):n&&c.find({channel:n}).then(e=>{if(e){let n=e.map(e=>e.listener);l.find({_id:{$in:n}}).then(n=>{e.forEach(e=>{let t=n.find(t=>t._id=e.listener);return delete t._id,Object.assign(e,t)}),t.json(e)})}else t.json(e)})}),i.post("/award",p,(e,t)=>{let n=e.body.members,i=e.body.aid;a.findOne({twitchID:e.user.integration.twitch.etid}).then(r=>{c.findOne({uid:i}).then(s=>{o.find({name:{$in:n}}).then(n=>{let a=n.map((t,n)=>{let o=t.channels,a=o.findIndex(e=>e.channelID===r.id);return o[a].achievements.push({aid:i,earned:Date.now()}),t.channels=o,t.save().then(t=>{y(e,{channel:r.owner,member:t.name,title:s.title})})});Promise.all(a).then(e=>{o.find({_id:{$in:r.members}}).then(e=>{let n=e.map(e=>({name:e.name,logo:e.logo,achievements:e.channels.filter(e=>e.channelID===r.id)[0].achievements}));t.json({members:n})})})})})})}),i.get("/icons",p,(e,t)=>{a.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{e?I(e.owner).then(n=>{let i=n.map(e=>{let t={...e._doc};return delete t.__v,delete t._id,t});t.json({images:i,defaultIcons:e.icons})}):t.json({error:!0})})}),i.get("/listeners",(e,t)=>{let n=e.query.channel;Array.isArray(n)||(n=n.split(",")),console.log(n),c.find({owner:{$in:n}}).then(e=>{e.map(e=>{if(e.earnable&&e.listener)return e.listener})}),l.find({channel:{$in:n}}).then(e=>{e.length>0?t.json(e):t.json([])})}),i.post("/listeners",(e,t)=>{console.log("achievements to process...");let n=e.body,i=new Date,r={};n.forEach(e=>{r[e.channel]=r[e.channel]||[],r[e.channel].push(e)}),Object.keys(r).forEach(t=>{a.findOne({owner:t}).then(n=>{r[t].forEach(r=>{let{channel:a,achievementID:l,tier:u,userID:p}=r,m={};r.userID||r.user;p?m["integration.twitch.etid"]=p:m.name=r.user,c.findOne({_id:l,channel:t}).then(a=>{o.findOne(m).then(o=>{if(o){p=o.integration.twitch.etid;let r=o.channels.findIndex(e=>e.channelID===n.id);if(r>=0){let s=o.channels[r].achievements,c=o.channels[r].sync;s.findIndex(e=>e.id===a.id)<0&&(o.channels[r].achievements.push({aid:a.uid,earned:i}),c&&u?D(a.id,o,n):o.save(),y(e,{channel:t,member:o.name,achievement:a.title}))}else o.preferences.autojoin?(o.channels.push({channelID:n.id,achievements:[{id:l,earned:i}]}),o.save().then(i=>{n.members.push(i.id),n.save().then(i=>{new h({twitchID:p,channelID:n._id,achievementID:l}).save().then(n=>{y(e,{channel:t,member:o.name,achievement:a.title})})})})):(new d({twitchID:o.integration.twitch.etid,name:o.name,channelID:n._id,achievementID:l}).save(),new h({twitchID:p,channelID:n._id,achievementID:l}).save(),y(e,{channel:t,member:o.name,achievement:a.title}))}else{let n,i,o={userID:r.userID,name:r.user};o.userID?o.name||(n=`https://api.twitch.tv/helix/users/?id=${r.userID}`):n=`https://api.twitch.tv/helix/users/?login=${r.user}`,(i=n?new Promise((e,t)=>{s.get(n,{headers:{"Client-ID":process.env.TCID}}).then(t=>{o.userID=t.data.data[0].id,o.name=t.data.data[0].login,e()})}):Promise.resolve()).then(()=>{d.findOne({twitchID:o.userID}).then(n=>{n||new d({twitchID:o.userID,name:o.name,channelID:t,achievementID:l}).save().then(n=>{v(e,{channel:t,member:o.name,achievement:a.title})})})})}})})})})})});let D=(e,t,n)=>{l.find({achType:{$in:["0","1"]},channel:n.owner}).then(i=>{if(i){let r=i.findIndex(t=>t.achievement===e),s=i.splice(r,1)[0],o=s.achType,a=s.condition,c=[];if("1"===o){if("0"===s.resubType?i.forEach(e=>{e.condition<=a&&c.push(e)}):i.forEach(e=>{"0"===e.achType?c.push(e):"1"===e.resubType&&e.condition<=a&&c.push(e)}),c.length>0){let i=t.channels,r=i.findIndex(e=>e.channelID===n.id);c.forEach(s=>{i[r].achievements.push({aid:s.aid,earned:Date.now()}),new h({twitchID:t.integration.twitch.etid,channelID:n._id,achievementID:e}).save()}),i[r].sync=!1,t.channels=i,t.save().then(e=>{})}}}})};e.exports=i},function(e,t){e.exports=require("uuid/v1")},function(e,t,n){const i=n(0),r=new(0,i.Schema)({twitchID:String,channelID:String,achievementID:String}),s=i.model("notice",r);e.exports=s},function(e,t,n){const i=n(2).Router(),r=n(1),s=n(9);n(8),n(0);i.get("/channels",(e,t)=>{let n=parseInt(e.query.offset)||0,i=parseInt(e.query.limit)||50,s=parseInt(e.query.total)||void 0;s?a(n,i,s).then(e=>{e.err?(t.status(500),t.json({channels:[],err:e.err})):t.json(e)}):s=r.estimatedDocumentCount().exec().then(e=>{a(n,i,s=e).then(e=>{e.err?(t.status(500),t.json({channels:[],err:e.err})):t.json(e)})})}),i.get("/listeners",(e,t)=>{let n=parseInt(e.query.offset)||0,i=parseInt(e.query.limit)||50,r=parseInt(e.query.total)||void 0;r?o(n,i,r).then(e=>{e.err?(t.status(500),t.json({listeners:[],error:e.err})):t.json(e)}):r=s.estimatedDocumentCount().exec().then(e=>{o(n,i,r=e).then(e=>{e.err?(t.status(500),t.json({listeners:[],error:e.err})):(console.log(e),t.json(e))})})});let o=(e,t,n)=>new Promise((i,r)=>{s.find().sort({_id:-1}).skip(e).limit(t).exec((r,s)=>{if(r)i({err:"Issue retrieving from Listener sets"});else{let r=s.map(e=>(console.log(e),{channel:e.channel,achievement:e.achievement,achType:e.achType,resubType:e.resubType,query:e.query,bot:e.bot,condition:e.condition})),o={listeners:r,total:n};r.length===t&&(o.offset=e+r.length),i(o)}})}),a=(e,t,n)=>new Promise((i,s)=>{r.find({$or:[{type:"verified"},{type:"admin"}]}).sort({_id:-1}).skip(e).limit(t).exec((r,s)=>{if(r)i({err:"Issue retrieving from User sets"});else{let r=s.map(e=>{let t={name:e.name,full_access:!1},n=e.integration.patreon;return n&&(n.forever||n.is_gold)&&(t["full-access"]=!0),t}),o={channels:r,total:n};r.length===t&&(o.offset=e+r.length),i(o)}})});e.exports=i}]);