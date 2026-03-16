import React, { useState } from "react";

type Filters = {
  availableOnly: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  maxDistanceKm?: number;
  category?: string;
};

type Props = {
  onApply: (filters: Filters) => void;
  onReset?: () => void;
};

export default function HostFilters({ onApply, onReset }: Props) {

  const [availableOnly, setAvailableOnly] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxDistanceKm, setMaxDistanceKm] = useState("");
  const [category, setCategory] = useState("");

  const handleApply = () => {

    onApply({
      availableOnly,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
      maxDistanceKm: maxDistanceKm ? Number(maxDistanceKm) : undefined,
      category: category || undefined,
    });

  };

  const handleReset = () => {

    setAvailableOnly(true);
    setMinPrice("");
    setMaxPrice("");
    setMinRating("");
    setMaxDistanceKm("");
    setCategory("");

    onReset?.();

  };

  return (

    <div style={styles.container}>

      {/* Disponibilité */}

      <div style={styles.row}>
        <span style={styles.label}>Disponible uniquement</span>

        <input
          type="checkbox"
          checked={availableOnly}
          onChange={(e)=>setAvailableOnly(e.target.checked)}
        />
      </div>

      {/* Prix */}

      <div style={styles.sectionTitle}>Prix ($)</div>

      <div style={styles.row}>

        <input
          placeholder="Min"
          type="number"
          value={minPrice}
          onChange={(e)=>setMinPrice(e.target.value)}
          style={styles.input}
        />

        <input
          placeholder="Max"
          type="number"
          value={maxPrice}
          onChange={(e)=>setMaxPrice(e.target.value)}
          style={styles.input}
        />

      </div>

      {/* Note */}

      <div style={styles.sectionTitle}>Note minimale ⭐</div>

      <input
        placeholder="Ex: 4.5"
        type="number"
        value={minRating}
        onChange={(e)=>setMinRating(e.target.value)}
        style={styles.input}
      />

      {/* Distance */}

      <div style={styles.sectionTitle}>Distance max (km)</div>

      <input
        placeholder="Ex: 10"
        type="number"
        value={maxDistanceKm}
        onChange={(e)=>setMaxDistanceKm(e.target.value)}
        style={styles.input}
      />

      {/* Catégorie */}

      <div style={styles.sectionTitle}>Catégorie</div>

      <input
        placeholder="Plomberie, Électricité..."
        value={category}
        onChange={(e)=>setCategory(e.target.value)}
        style={styles.input}
      />

      {/* Boutons */}

      <div style={styles.buttonRow}>

        <button style={styles.resetBtn} onClick={handleReset}>
          Réinitialiser
        </button>

        <button style={styles.applyBtn} onClick={handleApply}>
          Appliquer
        </button>

      </div>

    </div>

  );

}

const styles:any = {

container:{
  background:"#fff",
  padding:16,
  width:"100%",
  height:"100vh",
  boxSizing:"border-box"
},

sectionTitle:{
  fontWeight:600,
  marginTop:15,
  marginBottom:6
},

row:{
  display:"flex",
  justifyContent:"space-between",
  alignItems:"center",
  gap:10
},

label:{
  fontSize:14
},

input:{
  border:"1px solid #ddd",
  borderRadius:8,
  padding:10,
  marginBottom:10,
  flex:1
},

buttonRow:{
  display:"flex",
  justifyContent:"space-between",
  marginTop:20,
  gap:10
},

applyBtn:{
  background:"#FF6B6B",
  padding:"12px",
  borderRadius:8,
  flex:1,
  border:"none",
  color:"#fff",
  fontWeight:"bold",
  cursor:"pointer"
},

resetBtn:{
  border:"1px solid #ccc",
  padding:"12px",
  borderRadius:8,
  flex:1,
  background:"#fff",
  fontWeight:500,
  cursor:"pointer"
}

};