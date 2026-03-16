import React from "react";

const PALETTE = {
  tagBg: "#18233D",
  tagText: "#FFFFFF",
  border: "rgba(255,255,255,0.18)",
  active: "#FFD700"
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  categories: Category[];
  selectedCategory?: string | null;
  onPressCategory: (category: Category) => void;
};

export default function ListCategoryWeb({
  categories,
  onPressCategory,
  selectedCategory
}: Props){

  if(!categories || categories.length === 0) return null;

  return(

    <div style={{marginTop:20}}>

      <h3 style={styles.title}>Catégories</h3>

      <div style={styles.row}>

        {categories.map((cat)=>{

          const active = selectedCategory === cat.slug;

          return(

            <div
              key={cat.id}
              onClick={()=>onPressCategory(cat)}
              style={{
                ...styles.badge,
                ...(active && styles.badgeActive)
              }}
            >
              <span
                style={{
                  ...styles.badgeText,
                  ...(active && styles.badgeTextActive)
                }}
              >
                {cat.name}
              </span>
            </div>

          );

        })}

      </div>

    </div>

  );

}

const styles:any={

title:{
  color:"#FFFFFF",
  fontSize:18,
  fontWeight:800,
  marginBottom:10
},

row:{
  display:"flex",
  gap:12,
  flexWrap:"wrap"
},

badge:{
  background:PALETTE.tagBg,
  padding:"10px 16px",
  borderRadius:24,
  border:`1px solid ${PALETTE.border}`,
  cursor:"pointer",
  userSelect:"none"
},

badgeActive:{
  background:PALETTE.active
},

badgeText:{
  color:PALETTE.tagText,
  fontSize:14,
  fontWeight:600
},

badgeTextActive:{
  color:"#0A0F2C",
  fontWeight:700
}

};