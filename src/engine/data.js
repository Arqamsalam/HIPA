/*
 * Dictionaries used by the detection engine and the fake-data generator.
 * Everything is plain data: no network, no external files.
 */
(function (root) {
  'use strict';

  const words = (s) => s.trim().split(/\s+/).filter(Boolean);
  const lowerSet = (s) => new Set(words(s).map((w) => w.toLowerCase()));

  // ---- Real-name dictionaries (used to FIND names) ----
  const MALE_FIRST = lowerSet(`
    James John Robert Michael William David Richard Joseph Thomas Charles Christopher Daniel Matthew
    Anthony Donald Steven Paul Andrew Joshua Kenneth Kevin Brian George Timothy Ronald Edward Jason
    Jeffrey Ryan Jacob Gary Nicholas Eric Jonathan Stephen Larry Justin Scott Brandon Benjamin Samuel
    Gregory Alexander Patrick Raymond Dennis Jerry Tyler Aaron Jose Adam Nathan Henry Douglas Zachary
    Peter Kyle Noah Ethan Jeremy Walter Christian Keith Roger Terry Austin Sean Gerald Carl Harold Dylan
    Arthur Lawrence Jordan Jesse Bryan Billy Bruce Gabriel Joe Logan Alan Juan Albert Willie Elijah
    Wayne Randy Vincent Mason Roy Ralph Bobby Russell Bradley Philip Eugene Louis Harry Howard Liam
    Lucas Oliver Carlos Luis Miguel Jorge Pedro Manuel Ricardo Francisco Antonio Rafael Fernando Diego
    Alejandro Javier Sergio Eduardo Roberto Mohammed Muhammad Mohammad Ahmed Ahmad Ali Omar Hassan
    Hussein Ibrahim Yusuf Mustafa Khalid Tariq Imran Bilal Faisal Hamza Usman Umar Zain Arjun Rahul
    Raj Rajesh Vikram Sanjay Amit Anil Sunil Ravi Suresh Wei Jian Hao Ming Hiroshi Kenji Takeshi
    Dmitri Ivan Sergei Alexei Vladimir Kwame Kofi Chinedu Emeka Oluwaseun Tunde Abdul Abdullah Mark
    Bill Frank Jack Ray Glen Glenn Dale Gene Craig Todd Shawn Derek Travis Curtis Chad Marcus Leon
    Calvin Clarence Earl Ernest Francis Fred Herbert Jimmy Johnny Leonard Lloyd Martin Melvin Norman
    Phillip Stanley Victor Vernon Wesley Allen Neil Troy Cody Corey Evan Ian Isaac Caleb Connor Hunter
    Owen Wyatt Luke Max Leo Ezra Julian Hudson Grayson Levi Sebastian Mateo Santiago Angel
  `);
  const FEMALE_FIRST = lowerSet(`
    Mary Patricia Jennifer Linda Elizabeth Barbara Susan Jessica Sarah Karen Lisa Nancy Betty Sandra
    Margaret Ashley Kimberly Emily Donna Michelle Carol Amanda Melissa Deborah Stephanie Dorothy
    Rebecca Sharon Laura Cynthia Amy Kathleen Angela Shirley Brenda Emma Anna Pamela Nicole Samantha
    Katherine Christine Helen Debra Rachel Carolyn Janet Maria Catherine Heather Diane Olivia Julie
    Joyce Victoria Ruth Virginia Lauren Kelly Christina Joan Evelyn Judith Andrea Hannah Megan Cheryl
    Jacqueline Martha Madison Teresa Gloria Sara Janice Ann Anne Kathryn Abigail Sophia Frances Jean
    Alice Judy Isabella Julia Beverly Denise Marilyn Amber Danielle Brittany Diana Natalie Sophie Rose
    Alexis Kayla Lori Tiffany Jane Jenny Wendy Mia Ava Chloe Zoe Lucy Ella Grace Lily Harper Aria
    Fatima Aisha Ayesha Zainab Maryam Khadija Amina Sana Hina Noor Leila Layla Yasmin Priya Anjali
    Sunita Pooja Neha Deepa Lakshmi Mei Ling Yuki Sakura Keiko Olga Natasha Svetlana Irina Tatiana
    Rosa Carmen Guadalupe Lucia Sofia Valentina Gabriela Ana Isabel Elena Adriana Daniela Mariana
    Ngozi Chioma Adaeze Folake Peggy Doris Edna Gladys Mildred Irene Lois Marjorie Norma Phyllis
    Thelma Vera Agnes Ethel Florence Hazel Lillian Louise Bonnie Connie Darlene Joann Paula Rita
    Sheila Tammy Tina Yvonne Erin Molly Holly Leah Kristen Kristin Allison Courtney Brooke Haley
    Morgan Taylor Kaitlyn Jasmine Destiny Savannah Paige Audrey Claire Stella Violet Penelope Nora
    Eleanor Hope Faith Joy June April May Dawn Iris Ruby Pearl Jade
  `);
  const NEUTRAL_FIRST = lowerSet(`Alex Casey Riley Jamie Avery Quinn Cameron Drew Skyler Robin Jordan Taylor Morgan`);
  // First names that are also everyday words or places; only trusted with strong context.
  const AMBIGUOUS_FIRST = lowerSet(`
    Will Bill Mark May June April August Grace Hope Faith Joy Rose Iris Ruby Amber Jade Dawn Pearl
    Rich Frank Art Gene Pat Sue Carol Chase Christian Dale Drew Glen Guy Hunter Jack Jean Jordan
    Lane Lily Mason Max Miles Ray Reed Sage Sky Terry Violet Wade Ward Warren Victoria Georgia
    Virginia Austin Dallas Houston Florence Paris Sydney Angel Harper Taylor Morgan Paige Brooke
    Holly Joe Young Kelly Robin Leo Owen Luke Grayson Hudson Stella Claire Nora Sara Paula Erin
    Ali Max Ann Anne Mary Ivan Hazel Vera Joan Joyce Lucy Ella Mia Ava Zoe Noah Ian Neil Troy Earl
  `);

  const SURNAMES = lowerSet(`
    Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Hernandez Lopez Gonzalez
    Wilson Anderson Thomas Taylor Moore Jackson Martin Lee Perez Thompson White Harris Sanchez Clark
    Ramirez Lewis Robinson Walker Young Allen King Wright Scott Torres Nguyen Hill Flores Green Adams
    Nelson Baker Hall Rivera Campbell Mitchell Carter Roberts Gomez Phillips Evans Turner Diaz Parker
    Cruz Edwards Collins Reyes Stewart Morris Morales Murphy Cook Rogers Gutierrez Ortiz Morgan Cooper
    Peterson Bailey Reed Kelly Howard Ramos Kim Cox Ward Richardson Watson Brooks Chavez Wood James
    Bennett Gray Mendoza Ruiz Hughes Price Alvarez Castillo Sanders Patel Myers Long Ross Foster
    Jimenez Powell Jenkins Perry Russell Sullivan Bell Coleman Butler Henderson Barnes Gonzales Fisher
    Vasquez Simmons Romero Jordan Patterson Alexander Hamilton Graham Reynolds Griffin Wallace Moreno
    West Cole Hayes Bryant Herrera Gibson Ellis Tran Medina Aguilar Stevens Murray Ford Castro Marshall
    Owens Harrison Fernandez McDonald Woods Washington Kennedy Wells Vargas Henry Chen Freeman Webb
    Tucker Guzman Burns Crawford Olson Simpson Porter Hunter Gordon Mendez Silva Shaw Snyder Mason
    Dixon Munoz Hunt Hicks Holmes Palmer Wagner Black Robertson Boyd Rose Stone Salazar Fox Warren
    Mills Meyer Rice Schmidt Garza Daniels Ferguson Nichols Stephens Soto Weaver Ryan Gardner Payne
    Grant Dunn Kelley Spencer Hawkins Arnold Pierce Vazquez Hansen Peters Santos Hart Bradley Knight
    Elliott Cunningham Duncan Armstrong Hudson Carroll Lane Riley Andrews Alvarado Ray Delgado Berry
    Perkins Hoffman Johnston Matthews Pena Richards Contreras Willis Carpenter Lawrence Sandoval
    Guerrero George Chapman Rios Estrada Ortega Watkins Greene Nunez Wheeler Valdez Harper Burke
    Larson Santiago Maldonado Morrison Franklin Carlson Austin Dominguez Carr Lawson Jacobs O'Brien
    Lynch Singh Vega Bishop Montgomery Oliver Jensen Harvey Williamson Gilbert Dean Sims Espinoza
    Howell Li Wong Reid Hanson Le McCoy Garrett Burton Fuller Wang Weber Welch Rojas Lucas Marquez
    Fields Park Yang Little Banks Padilla Day Walsh Bowman Schultz Luna Fowler Mejia Davidson Acosta
    Brewer Holland Juarez Newman Pearson Curtis Cortez Douglas Schneider Joseph Barrett Navarro
    Figueroa Keller Avila Wade Molina Stanley Hopkins Campos Barnett Bates Chambers Caldwell Beck
    Lambert Miranda Byrd Craig Ayala Lowe Frazier Powers Neal Leonard Gregory Carrillo Sutton Fleming
    Rhodes Shelton Schwartz Norris Jennings Watts Duran Walters Cohen McDaniel Moran Parks Steele
    Vaughn Becker Holt Barker Hale Benson Haynes Horton Miles Lyons Pham Graves Bush Thornton Wolfe
    Warner Cabrera McKinney Mann Zimmerman Dawson Lara Fletcher Page McCarthy Robles Cervantes Solis
    Erickson Reeves Chang Klein Salinas Fuentes Baldwin Simon Velasquez Hardy Higgins Aguirre Lin
    Cummings Chandler Sharp Barber Bowen Ochoa Dennis Robbins Liu Ramsey Francis Griffith Paul Blair
    O'Connor Cardenas Pacheco Cross Calderon Quinn Moss Swanson Chan Rivas Khan Rodgers Serrano
    Fitzgerald Rosales Stevenson Christensen Manning Gill Curry McLaughlin Harmon McGee Gross Doyle
    Garner Newton Burgess Reese Walton Blake Trujillo Adkins Brady Goodman Roman Webster Goodwin
    Fischer Huang Potter Montoya Todd Wu Hines Mullins Castaneda Malone Cannon Tate Mack Sherman
    Hubbard Hodges Zhang Guerra Wolf Valencia Saunders Franco Rowe Gallagher Farmer Hammond Hampton
    Townsend Ingram Wise Gallegos Clarke Barton Schroeder Maxwell Waters Logan Camacho Strickland
    Norman Colon Parsons Frank Harrington Glover Osborne Buchanan Casey Floyd Patton Ibarra Ball
    Doe Roe Ahmed Ali Hussain Hassan Rahman Iqbal Malik Qureshi Siddiqui Chaudhry Sheikh Butt Mirza
    Shah Sharma Gupta Kumar Reddy Rao Nair Iyer Mehta Desai Joshi Kapoor Verma Das Bose Banerjee
    Tanaka Suzuki Sato Watanabe Yamamoto Nakamura Kobayashi Ito Ivanov Petrov Smirnov Kowalski Novak
    Okafor Okonkwo Adeyemi Mensah Abubakar Nwosu Mohammed Abdullah Haddad Khoury Nasser Farah
    Ellison Cohen Levy Friedman Katz Goldberg Rosen Shapiro Kaplan Weiss Stein Schwartz Becker
    Russo Romano Ricci Esposito Bianchi Rossi Costa Ferrari Murray Doherty Kelleher O'Neill Byrne
  `);

  // ---- Medical eponyms: capitalised words that look like names but are medical terms ----
  const EPONYMS = lowerSet(`
    Alzheimer Alzheimers Parkinson Parkinsons Crohn Crohns Cushing Cushings Addison Addisons Graves
    Hashimoto Hashimotos Hodgkin Hodgkins Huntington Huntingtons Tourette Tourettes Asperger Aspergers
    Kaposi Raynaud Raynauds Sjogren Sjogrens Sjögren Guillain Barre Barré Marfan Klinefelter Wernicke
    Korsakoff Paget Pagets Peyronie Dupuytren Babinski McBurney Kernig Brudzinski Homan Homans
    Trendelenburg Glasgow Apgar Foley Swan-Ganz Ganz Whipple Nissen Billroth Roux Roux-en-Y Hartmann
    Kocher Pfannenstiel Heimlich Valsalva Epley Romberg Tinel Phalen Finkelstein Lachman McMurray Gram
    Ziehl Neelsen Ziehl-Neelsen Giemsa Coombs Mantoux Doppler Holter Hickman Jackson-Pratt Gleason
    Breslow Framingham Killip Mallampati Braden Wolff-Parkinson-White Barrett Barretts Zenker Meckel
    Hirschsprung Kawasaki Takayasu Wegener Behcet Behçet Reiter Stevens-Johnson Epstein Epstein-Barr
    Lyme Tay-Sachs Gaucher Fabry Pompe Niemann-Pick Creutzfeldt Creutzfeldt-Jakob Charcot
    Charcot-Marie-Tooth Duchenne Ehlers-Danlos Prader-Willi Angelman Rett Noonan Bartter Gitelman
    Liddle Fanconi Alport Goodpasture Henoch-Schonlein Henoch-Schönlein Kussmaul Cheyne-Stokes
    Korotkoff Osler Janeway Virchow Virchows Trousseau Chvostek Rovsing Courvoisier Kerley
    Westermark Mallory-Weiss Boerhaave Plummer-Vinson Schatzki Zollinger-Ellison Peutz-Jeghers
    Krukenberg Horner Horners Pancoast Lambert-Eaton Bence Bence-Jones Waldenstrom Waldenström
    Burkitt Burkitts Reed-Sternberg Sezary Sézary Auer Howell-Jolly Heinz Dohle Döhle Willebrand
    Brown-Sequard Brown-Séquard Arnold-Chiari Chiari Dandy-Walker Erb Klumpke Colles Monteggia
    Galeazzi Lisfranc Chopart Maisonneuve Segond Osgood-Schlatter Legg-Calve-Perthes Scheuermann
    Achilles Morgagni Bochdalek DiGeorge Kasabach-Merritt Sturge-Weber Osler-Weber-Rendu Kartagener
    Wiskott-Aldrich Chediak-Higashi Lesch-Nyhan Menkes Hurler Sanfilippo Morquio Krabbe Canavan
    Zellweger Refsum Kearns-Sayre Leber Friedreich Gehrig Lhermitte Uhthoff Devic Binswanger Lewy
    Gerstmann Wallenberg Parinaud Capgras Munchausen Münchausen Cotard Tietze Prinzmetal Brugada
    Ebstein Eisenmenger Fallot Dressler Blalock-Taussig Fontan Bentall Caprini Child-Pugh MELD Ranson
    Balthazar Rockall Blatchford Alvarado Centor Karnofsky ECOG Zubrod Ballard Dubowitz Finnegan
    Barthel Folstein  Spetzler-Martin Cormack-Lehane Aldrete Fick Henderson-Hasselbalch
    Cockcroft-Gault Friedewald Mosteller Holliday-Segar Parkland Lund-Browder Sengstaken-Blakemore
    Dobhoff Malecot Penrose Hemovac Tenckhoff Groshong Quinton Permacath Mediport Broviac Ommaya
    Yankauer Ambu Macintosh Guedel Venturi Unna Jobst Kirschner Steinmann Ilizarov Charnley Bankart
    Hill-Sachs Latarjet Lachman Spurling Hoover Waddell Dix-Hallpike Hallpike Semont Rinne Schirmer
    Seidel Amsler Snellen Ishihara Adson Froment Kanavel Bouchard Heberden Gottron Auspitz Koebner
    Nikolsky Darier Muehrcke Beau Mees Duroziez Quincke Traube Cullen Kehr Blumberg Sister-Mary-Joseph
    Chaddock Oppenheim Argyll Holmes-Adie Dalrymple Pemberton Hurthle Hürthle Sipple Wermer Sheehan
    Kallmann Asherman Stein-Leventhal Meigs Sertoli Leydig Bartholin Skene Nabothian Naegele 
      Braxton Braxton-Hicks  Ritgen Couvelaire Shirodkar Bakri McRoberts Zavanelli
    Mauriceau Kielland Mityvac Glasgow-Blatchford  Geneva Fleischner Bosniak Fuhrman Dukes Lugano
    Durie-Salmon Binet  Sokal Gardner-Wells Pavlik Ponseti Ortolani  Galeazzi Thompson-Test
     Lhermitte Rumpel-Leede Nikolsky Weil Wilms   Kaposi Merkel Paneth Kupffer Schwann
    Langerhans Purkinje Golgi  Cori  Frank-Starling Bernoulli Poiseuille Laplace Gram-positive
    Gram-negative Papanicolaou Pap Hemoccult Guaiac Westergren Wintrobe Mantoux Tzanck KOH Wood's
    Lugol Schiller   Snellen         
  `);
  // Words that, when they follow a capitalised word, mark it as an eponym / named thing.
  const EPONYM_FOLLOWERS = `disease|syndrome|sign|signs|test|testing|score|scale|criteria|criterion|catheter|maneuver|manoeuvre|procedure|palsy|phenomenon|reflex|triad|classification|fracture|tube|operation|repair|tumou?r|lymphoma|sarcoma|carcinoma|esophagus|oesophagus|ulcer|stain|line|node|cyst|law|effect|method|technique|position|incision|forceps|retractor|clamp|needle|drain|bag|pump|stockings?|splint|cast|apparatus|formula|equation|index|grade|grading|stage|staging|type|virus|bacillus|cells?|body|bodies|nodules?|duct|gland|canal|space|area|ring|knot|lesion|murmur|sound|pulse|respirations?|breathing|ratio|rule|rules|questionnaire|exam|examination|view|shunt|valve|anomaly|malformation|deformity|contracture|neuroma|neuralgia|aneurysm|hernia|diverticulum|thyroiditis|encephalopathy|disorder|cerclage|anastomosis|fundoplication|tear|lesions|spots?|nodes|plaques?|fibers|fibres|cardiomyopathy|anemia|anaemia|leukemia|leukaemia|arthritis|dementia|ataxia|dystrophy|cirrhosis|esophagitis|pneumonia|abscess|hemorrhoids|gangrene|phenomenon|tremor|gait|stridor|crisis|crises|point|curve|curves|wave|waves|block|bundle|space|pouch|fold|folds|membrane|layer|plexus|loop|angle|triangle|disc|disk`;

  // Words that look capitalised but are never names (sections, clinical words, labels...)
  const STOPWORDS = lowerSet(`
    a an the and or but nor so yet for of in on at to from by with without within into onto over
    under above below about after before during since until via per vs versus as is are was were be
    been being am has have had do does did will would shall should can could may might must not no
    yes none nil unknown other others this that these those there here then than when where which who
    whom whose what why how all any each every both either neither some such same own only very just
    also too again further once more most less least much many few several he she they them his her
    hers their theirs him we us our ours you your yours i me my mine it its itself himself herself
    themselves myself patient patients pt pts name names male female man woman men women boy girl
    child infant baby newborn adult elderly gentleman lady mr mrs ms miss mx dr doctor prof md do rn
    np pa pa-c lpn cna crna aprn dnp phd pharmd dds dmd dpm lcsw msw mph mba bsn msn fnp fnp-c
    fnp-bc mbbs facs facp jr sr ii iii iv history present illness hpi chief complaint cc assessment
    plan impression diagnosis diagnoses dx ddx differential summary discharge admission admit
    admitted discharged hospital course hospitalization exam examination physical review systems ros
    pmh psh fh sh past medical surgical social medications medication meds allergies allergy
    nkda nka labs lab laboratory results result data vitals vital signs imaging radiology findings
    finding procedure procedures note notes progress consult consultation report reports addendum
    signature signed date time dob mrn age sex gender race ethnicity language religion marital
    status single married divorced widowed separated insurance phone address email contact
    relationship emergency department ed er icu micu sicu ccu picu nicu or pacu ward unit floor room
    bed service team medicine surgery cardiology neurology oncology pediatrics obstetrics gynecology
    psychiatry pathology orthopedics urology nephrology pulmonology gastroenterology endocrinology
    rheumatology dermatology hematology infectious internal general primary care clinic center
    medical health healthcare mental behavioral public community regional national state county city
    university college school memorial urgent home nursing rehab rehabilitation hospice skilled
    facility acute chronic mild moderate severe stable unstable critical improved improving
    worsening resolved normal abnormal positive negative pending noted denies denied reports
    reported states stated complains complaining presents presented presenting alert oriented awake
    conscious unresponsive afebrile febrile left right bilateral upper lower anterior posterior
    medial lateral proximal distal superior inferior heent neck chest heart lungs lung abdomen
    abdominal extremities extremity skin neuro neurologic neurological psych musculoskeletal
    genitourinary gu gi cv resp respiratory cardiovascular gastrointestinal constitutional eyes ears
    nose throat mouth back spine pelvis rectal breast breasts blood pressure pulse rate temp
    temperature weight height bmi oxygen saturation spo2 respirations pain score code full dnr dni
    continue start started stop stopped hold held give given take taken daily twice morning evening
    night nightly today tomorrow yesterday tonight weekly monthly yearly annual prn po iv im sq sc
    subq mg mcg ml units tablet tablets capsule dose doses monday tuesday wednesday thursday friday
    saturday sunday january february march april may june july august september october november
    december jan feb mar apr jun jul aug sep sept oct nov dec spring summer fall autumn winter new
    old first second third last next prior previous recent current initial final follow followup
    follow-up return returns returned call called please see seen per post stage grade class
    level phase cycle day days week weeks month months year years hour hours minute minutes
    cbc bmp cmp ua ct mri ekg ecg echo cxr xray x-ray us ultrasound pet tsh inr ptt wbc rbc hgb hct
    plt na k cl co2 bun cr glu ca mg phos alt ast alk bili tbili alb ldl hdl tg a1c hba1c bnp
    troponin lactate lipase amylase crp esr procalcitonin culture cultures sensitivity sinus
    rhythm tachycardia bradycardia afib nsr ok okay thanks thank regards sincerely dear hello hi re
    subject attn fwd fw bcc sent received page continued end total mother father mom dad wife
    husband spouse son daughter sister brother partner caregiver guardian parent parents children
    kids friend friends neighbor neighbors aunt uncle cousin niece nephew grandson granddaughter
    grandmother grandfather grandparent grandparents relative relatives family member members
    significant catholic muslim jewish hindu buddhist protestant baptist methodist lutheran
    american african asian hispanic latino latina caucasian english spanish french german chinese
    arabic urdu hindi russian portuguese korean japanese vietnamese tagalog italian polish reactive
    nonreactive detected undetected limits wnl unremarkable remarkable insignificant clear cloudy
    regular irregular soft tender nontender distended nondistended guarding rebound murmur murmurs
    rub gallop rales crackles wheezes rhonchi edema cyanosis clubbing jaundice rash lesion lesions
    mass masses nodule wound incision drain catheter line tube port device implant pacemaker
    defibrillator stent graft valve shunt minimal trace small medium large marked extensive diffuse
    focal multifocal scattered numerous rare occasional frequent constant intermittent sharp dull
    aching burning stabbing throbbing radiating nonradiating sudden gradual onset duration severity
    quality location timing context modifying factors associated symptoms otherwise pertinent
    noncontributory unchanged above attached enclosed reference ref approx approximately around
    estimated est plus minus consider check obtain order repeat monitor discussed counseled advised
    recommend recommended increase decrease discontinue transfer appreciate spoke reviewed received
    lives works smokes drinks quit former never retired employed unemployed disabled independent
    ambulates uses taking takes tolerating tolerated feels felt notes appears appeared well awake
    sleeping resting complains admits endorses no denies vaccine vaccines vaccination flu covid
    covid-19 sars-cov-2 influenza hiv hcv hbv tb mrsa vre uti copd chf cad ckd esrd dm htn hld osa
    gerd dvt pe mi cva tia aki sob cp n/v abd ext gen tablet capsule solution injection inhaler
    patch cream ointment drops suspension syrup extended release er xr sr dr ec odt hcl
    acetaminophen ibuprofen aspirin tylenol advil motrin lasix coumadin warfarin heparin insulin
    metformin lisinopril amlodipine atorvastatin metoprolol albuterol prednisone vancomycin
    ceftriaxone zosyn penicillin amoxicillin morphine dilaudid oxycodone norco percocet zofran
    protonix pepcid colace senna miralax ativan haldol seroquel xanax ambien lipitor eliquis xarelto
    plavix keppra dilantin synthroid levothyroxine gabapentin neurontin lyrica zoloft prozac
    lexapro wellbutrin effexor cymbalta trazodone sinemet aricept namenda donepezil memantine
    medicare medicaid aetna cigna humana anthem kaiser tricare uhc unitedhealthcare bcbs blue cross
    shield self-pay uninsured hmo ppo
    impression recommendations recommendation disposition instructions education counseling
    attending resident fellow intern provider physician surgeon nurse pharmacist therapist
    technician tech staff case manager social worker chaplain interpreter translator volunteer
    student consultant consultants service services specimen sample samples collected reported
    verified final preliminary corrected amended ordering performing reference range ranges flag
    flags high low critical units value values component test tests panel panels sodium potassium
    chloride bicarbonate glucose calcium magnesium phosphorus creatinine albumin protein bilirubin
    hemoglobin hematocrit platelets platelet leukocytes neutrophils lymphocytes monocytes
    eosinophils basophils ferritin iron vitamin folate cholesterol triglycerides urine urinalysis
    color appearance specific gravity ketones nitrite esterase bacteria casts crystals epithelial
    preop postop pre-op post-op operative intraoperative anesthesia general spinal epidural local
    sedation estimated loss fluids complications condition disposition tolerated
  `);

  // Credentials that may follow a name: "Jane Doe, MD".
  const CREDENTIALS = 'M\\.D\\.|MD|D\\.O\\.|DO|R\\.N\\.|RN|BSN|MSN|NP|APRN|PA-C|CRNA|Ph\\.D\\.|PhD|PharmD|DPM|DDS|DMD|LCSW|LPN|MSW|DPT|FNP-BC|FNP-C|FNP|MBBS|DNP|CNM|MPH|FACS|FACP|FACC';

  const STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
    CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
    IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
    ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
    NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
    ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
    RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
    UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
    WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', PR: 'Puerto Rico'
  };

  const COUNTRIES = lowerSet(`
    Mexico Canada Guatemala Honduras Salvador Nicaragua Cuba Haiti Jamaica Colombia Venezuela Peru
    Ecuador Brazil Argentina Chile Bolivia Paraguay Uruguay England Scotland Ireland Wales Britain
    France Germany Spain Portugal Italy Greece Poland Russia Ukraine Turkey Egypt Morocco Nigeria
    Ghana Kenya Ethiopia Somalia Sudan Congo Africa Asia Europe India Pakistan Bangladesh Nepal
    China Japan Korea Vietnam Thailand Philippines Indonesia Malaysia Iran Iraq Syria Lebanon Jordan
    Israel Palestine Afghanistan Yemen Saudi Arabia Australia Zealand Liberia Senegal Cameroon
    Puerto Rico Dominican Republic Abroad Overseas Europe
  `);

  // A sample of US cities used for context-based detection ("lives in Houston").
  const CITIES = lowerSet(`
    NewYork LosAngeles Chicago Houston Phoenix Philadelphia SanAntonio SanDiego Dallas SanJose
    Austin Jacksonville FortWorth Columbus Charlotte Indianapolis SanFrancisco Seattle Denver
    Washington Nashville OklahomaCity ElPaso Boston Portland LasVegas Detroit Memphis Louisville
    Baltimore Milwaukee Albuquerque Tucson Fresno Sacramento KansasCity Mesa Atlanta Omaha
    ColoradoSprings Raleigh LongBeach VirginiaBeach Miami Oakland Minneapolis Tulsa Tampa Arlington
    NewOrleans Wichita Bakersfield Cleveland Aurora Anaheim Honolulu SantaAna Riverside CorpusChristi
    Lexington Henderson Stockton SaintPaul StPaul Cincinnati StLouis SaintLouis Pittsburgh Greensboro
    Lincoln Anchorage Plano Orlando Irvine Newark Durham ChulaVista Toledo FortWayne StPetersburg
    Laredo JerseyCity Chandler Madison Lubbock Scottsdale Reno Buffalo Gilbert Glendale
    NorthLasVegas WinstonSalem Chesapeake Norfolk Fremont Garland Irving Hialeah Richmond Boise
    Spokane BatonRouge Tacoma SanBernardino Modesto Fontana DesMoines Moreno SantaClarita Fayetteville
    Birmingham Oxnard Rochester PortStLucie GrandRapids Huntsville SaltLakeCity Frisco Yonkers Amarillo
    Glendale HuntingtonBeach McKinney Montgomery Augusta Akron LittleRock Tempe Columbus Overland
    GrandPrairie Tallahassee CapeCoral Mobile Knoxville Shreveport Worcester Ontario Vancouver
    SiouxFalls Chattanooga Brownsville FortLauderdale Providence NewportNews RanchoCucamonga
    SantaRosa Peoria Oceanside ElkGrove Salem PembrokePines Eugene GardenGrove CaryNC FortCollins
    Corona Springfield Jackson Alexandria Hayward Clarksville Lakewood Lancaster Salinas Palmdale
    Hollywood Springfield Macon Sunnyvale Pomona Killeen Escondido Pasadena NapervilLe Naperville
    Bellevue Joliet Murfreesboro Midland Rockford Paterson Savannah Bridgeport Torrance McAllen
    Syracuse Surprise Denton Roseville Thornton Miramar Mesquite Olathe Dayton Carrollton Waco
    Orange Fullerton Charleston WestValleyCity Visalia Hampton Gainesville Warren Coral Cedar
    Sterling Stamford Concord Hartford NewHaven Topeka Elizabeth Columbia Albany Annapolis Trenton
    Dover Harrisburg Montpelier Augusta Concord Providence Cheyenne Bismarck Pierre Helena Juneau
    Olympia Carson Frankfort Jefferson Lansing AnnArbor Flint Kalamazoo Dearborn Duluth
    Fargo Billings Missoula Flagstaff Yuma SantaFe LasCruces Odessa Abilene Tyler Beaumont Galveston
    Pensacola Sarasota Naples Daytona Gainesville Ocala Lakeland Boca BocaRaton WestPalmBeach
    Asheville Wilmington Greenville Spartanburg Knoxville Bristol Roanoke Lynchburg Charlottesville
    Morgantown Scranton Allentown Erie Lancaster Reading Camden Hoboken Brooklyn Queens Bronx
    Manhattan StatenIsland Harlem Cambridge Somerville Lowell Quincy Brockton Burlington Bangor
    Portsmouth Nashua Manchester
  `.replace(/([a-z])([A-Z])/g, '$1$2'));
  // City list stored with spaces removed and lower-cased so "San Antonio" -> "sanantonio".
  const CITY_KEYS = new Set([...CITIES].map((c) => c.replace(/[^a-z]/g, '')));

  // Safe Harbor: 3-digit ZIP prefixes covering <= 20,000 people must become 000.
  const RESTRICTED_ZIP3 = new Set(['036', '059', '063', '102', '203', '556', '692', '790', '821',
    '823', '830', '831', '878', '879', '884', '890', '893']);

  // ---- Fake data (used to REPLACE identifiers) ----
  const FAKE = {
    male: words(`Aaron Adrian Albert Andre Barrett Bennett Caleb Calvin Colin Darren Desmond Elliot
      Emmett Felix Gavin Graham Harvey Hugo Isaac Jasper Joel Julian Keaton Lance Malcolm Marcus
      Milo Nolan Oscar Preston Quentin Roland Rowan Silas Simon Spencer Theo Tobias Victor Wesley
      Xavier Zane Dorian Everett Gideon Lionel Mitchell Reginald Stuart Warren`),
    female: words(`Adele Alana Bianca Camila Celeste Clara Daphne Delia Eleanor Elise Fiona Gemma
      Georgina Helena Imogen Ingrid Isla Juliet Kira Lena Lydia Mabel Maeve Marina Matilda Nadia
      Odette Phoebe Rhea Sabrina Selena Tessa Thea Una Willa Wren Yvette Zara Beatrice Cordelia
      Esther Felicity Harriet Josephine Lorraine Miriam Rosalind Vivian`),
    neutral: words(`Alexis Avery Blair Cameron Dakota Ellis Emerson Finley Jamie Kendall Peyton Quinn
      Reese Riley Sawyer Skyler Sloane Shannon Jessie Kai`),
    last: words(`Abernathy Ainsworth Aldridge Ashby Atwood Bancroft Barlow Beckett Blackwood Bramwell
      Calloway Carrington Castellano Chamberlain Colfax Corwin Dalgleish Delacourt Draycott Easton
      Ellery Everhart Fairbanks Farrow Fenwick Fitzroy Galloway Garnett Grisham Halloway Harcourt
      Hawthorne Holbrook Huxley Iverson Jessup Kendrick Kingsley Lachlan Langford Larkin Lockwood
      Lowell Marchetti Merriweather Montague Northcott Oakley Okoro Pemberton Prescott Quimby
      Radcliffe Ravenscroft Redfield Rockwell Rutherford Sinclair Stanhope Talbot Thackeray Thornbury
      Underhill Vanderberg Wainwright Westbrook Whitlock Winslow Yardley Zimmer Alcott Bellamy
      Brandt Cardenal Delmar Escobedo Faraday Hollis Kowalczyk Lindqvist Moreau Nakashima Ostrowski
      Petrakis Quintero Renner Solberg Tavares Valdivia Wexler Yoshida`),
    streets: words(`Maple Oak Cedar Pine Elm Willow Birch Aspen Juniper Magnolia Chestnut Sycamore
      Hawthorn Laurel Spruce Poplar Cypress Hickory Linden Alder Meadow Orchard Harbor Ridge Summit
      Brookside Lakeview Hillcrest Fairview Sunset Riverbend Stonegate Briarwood Foxglove Clover
      Heron Kestrel Larkspur Primrose Bluebell Thistle Copper Granite`),
    cities: words(`Ashford Bellmont Briarcliff Cedarville Clearbrook Crestview Eastbrook Elmhurst
      Fairhaven Glenwood Greenfield Hillsdale Kingsbridge Lakeshore Maplewood Millbrook Northgate
      Oakridge Pinecrest Ridgefield Riverton Rosedale Silverlake Springdale Stonebridge Thornbury
      Westfield Willowbrook Woodhaven Ambleside Brookvale Coldwater Dunmore Easton Foxborough
      Hartwell Ivydale Larkhaven Mossgrove Newbridge Pinehurst Quarryville Redwater Sandhaven`),
    facilityPrefix: words(`Silverbrook Maplecrest Brightwater Oakhaven Stonebridge Willowmere
      Clearbrook Pinehaven Elmstead Ashgrove Fernhill Larkfield Riverbend Cedarcrest Northvale
      Westmoor Highcliff Meadowview Lakehaven Summitview`),
    companies: [
      'Northwind Logistics', 'Bluebird Manufacturing', 'Copperline Industries', 'Evergreen Supply Co.',
      'Summit Ridge Partners', 'Brightpath Services', 'Ironwood Construction', 'Silverleaf Foods',
      'Clearwater Systems', 'Oakmont Retail Group', 'Redstone Freight', 'Harborlight Insurance',
      'Granite Peak Mining', 'Willowtree Software', 'Lakeside Textiles', 'Sunfield Farms'
    ]
  };

  const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];

  const api = {
    MALE_FIRST, FEMALE_FIRST, NEUTRAL_FIRST, AMBIGUOUS_FIRST, SURNAMES, EPONYMS, EPONYM_FOLLOWERS,
    STOPWORDS, CREDENTIALS, STATES, COUNTRIES, CITY_KEYS, RESTRICTED_ZIP3, FAKE, MONTHS_FULL,
    isFirstName: (w) => MALE_FIRST.has(w) || FEMALE_FIRST.has(w) || NEUTRAL_FIRST.has(w)
  };

  root.DeidData = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
