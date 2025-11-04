   {customer_phone.startsWith('+') && (
     <a href={`https://wa.me/${customer_phone.replace(/[^0-9]/g, '')}`}>
       <MessageCircle className="size-4" />
     </a>
   )}